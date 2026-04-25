from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Match, Team, Player, Innings, BattingScore, BowlingScore, BallEvent
from .serializers import MatchSerializer, MatchListSerializer, MatchLiveSerializer, TeamSerializer, PlayerSerializer
from .logic import record_ball, undo_ball

class MatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.all().order_by('-created_at')
    def get_serializer_class(self):
        if self.action == 'list':
            return MatchListSerializer
        return MatchSerializer

    def get_queryset(self):
        queryset = Match.objects.select_related('team1', 'team2').all().order_by('-created_at')
        if self.action in ['retrieve', 'live_state', 'start_innings', 'record_ball', 'undo_ball', 'next_batsman', 'next_bowler']:
            queryset = queryset.select_related('winner').prefetch_related(
                'innings__batting_team__players',
                'innings__bowling_team__players',
                'innings__batting_scores__player',
                'innings__bowling_scores__player',
                'innings__balls__bowler'
            )
        return queryset

    def get_object(self):
        return super().get_object()

    @action(detail=False, methods=['post'], url_path='quick')
    def quick_match(self, request):
        """
        Creates a quick match with team names and player lists.
        """
        from django.db import transaction
        
        team1_name = request.data.get('team1_name', 'Team A').strip()
        team2_name = request.data.get('team2_name', 'Team B').strip()
        team1_players = request.data.get('team1_players', [])
        team2_players = request.data.get('team2_players', [])
        overs = int(request.data.get('overs', 20))
        last_man_stands = request.data.get('last_man_stands', False)

        if not team1_players or not team2_players:
            return Response({'error': 'Both teams must have players'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                team1 = Team.objects.create(name=team1_name)
                team2 = Team.objects.create(name=team2_name)
                
                players_to_create = []
                for name in team1_players:
                    players_to_create.append(Player(name=name.strip(), team=team1))
                for name in team2_players:
                    players_to_create.append(Player(name=name.strip(), team=team2))
                
                Player.objects.bulk_create(players_to_create)
                    
                match = Match.objects.create(
                    team1=team1,
                    team2=team2,
                    overs=overs,
                    players_per_team=max(len(team1_players), len(team2_players)),
                    last_man_stands=last_man_stands,
                    status='setup'
                )
                
            return Response(MatchLiveSerializer(match).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='live')
    def live_state(self, request, pk=None):
        match = self.get_object()
        return Response(MatchLiveSerializer(match).data)

    @action(detail=True, methods=['post'], url_path='start-innings')
    def start_innings(self, request, pk=None):
        # Use get_object to leverage optimized prefetching
        match = self.get_object()
        innings_no = int(request.data.get('innings_no'))
        batting_team_id = str(request.data.get('batting_team_id'))
        
        # Select batting team based on ID
        if batting_team_id == str(match.team1.id):
            batting_team = match.team1
            bowling_team = match.team2
        else:
            batting_team = match.team2
            bowling_team = match.team1
        
        target = None
        if innings_no == 2:
            first_innings = match.innings.get(innings_no=1)
            target = first_innings.total_runs + 1
            
        Innings.objects.create(
            match=match,
            innings_no=innings_no,
            batting_team=batting_team,
            bowling_team=bowling_team,
            target=target
        )
        
        match.current_innings_no = innings_no
        match.status = 'live'
        match.save()
        
        # Re-fetch the match with the new innings prefetched
        match = self.get_object()
        return Response(MatchLiveSerializer(match).data)

class InningsViewSet(viewsets.GenericViewSet):
    queryset = Innings.objects.all()

    @action(detail=True, methods=['post'], url_path='ball')
    def record_ball(self, request, pk=None):
        innings_id = pk
        try:
            record_ball(innings_id, request.data)
            match = Match.objects.select_related('team1', 'team2').prefetch_related(
                'innings__batting_scores__player', 
                'innings__bowling_scores__player',
                'innings__balls__bowler'
            ).get(innings__id=innings_id)
            return Response(MatchLiveSerializer(match).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='undo')
    def undo_ball(self, request, pk=None):
        innings_id = pk
        try:
            undo_ball(innings_id)
            match = Match.objects.select_related('team1', 'team2').prefetch_related(
                'innings__batting_scores__player', 
                'innings__bowling_scores__player',
                'innings__balls__bowler'
            ).get(innings__id=innings_id)
            return Response(MatchLiveSerializer(match).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='next-batsman')
    def next_batsman(self, request, pk=None):
        innings = self.get_object()
        player_id = request.data.get('player_id')
        player = Player.objects.get(id=player_id)
        
        # If a striker already exists, the new player becomes the non-striker.
        # Otherwise, the new player becomes the striker.
        has_striker = BattingScore.objects.filter(innings=innings, is_at_crease=True, is_striker=True).exists()
        
        BattingScore.objects.update_or_create(
            innings=innings, 
            player=player, 
            defaults={'is_at_crease': True, 'is_striker': not has_striker}
        )
        
        match = Match.objects.select_related('team1', 'team2').prefetch_related(
            'innings__batting_scores__player', 
            'innings__bowling_scores__player',
            'innings__balls__bowler'
        ).get(innings=innings)
        return Response(MatchLiveSerializer(match).data)

    @action(detail=True, methods=['post'], url_path='next-bowler')
    def next_bowler(self, request, pk=None):
        innings = self.get_object()
        player_id = request.data.get('player_id')
        player = Player.objects.get(id=player_id)
        
        # Rule: No bowler can bowl two consecutive overs
        last_ball = BallEvent.objects.filter(innings=innings).last()
        if last_ball and last_ball.bowler == player and innings.total_balls % 6 == 0 and innings.total_balls > 0:
            return Response({"error": "This bowler just finished an over and cannot bowl consecutive overs."}, status=status.HTTP_400_BAD_REQUEST)

        BowlingScore.objects.filter(innings=innings, is_current=True).update(is_current=False)
        score, created = BowlingScore.objects.get_or_create(innings=innings, player=player)
        score.is_current = True
        score.save()
        
        match = Match.objects.select_related('team1', 'team2').prefetch_related(
            'innings__batting_scores__player', 
            'innings__bowling_scores__player',
            'innings__balls__bowler'
        ).get(innings=innings)
        return Response(MatchLiveSerializer(match).data)
