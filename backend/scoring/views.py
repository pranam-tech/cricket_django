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
        team1_name = request.data.get('team1_name', 'Team A')
        team2_name = request.data.get('team2_name', 'Team B')
        team1_players = request.data.get('team1_players', [])
        team2_players = request.data.get('team2_players', [])
        overs = request.data.get('overs', 20)
        last_man_stands = request.data.get('last_man_stands', False)
        
        team1 = Team.objects.create(name=team1_name)
        team2 = Team.objects.create(name=team2_name)
        
        for name in team1_players:
            Player.objects.create(name=name, team=team1)
        for name in team2_players:
            Player.objects.create(name=name, team=team2)
            
        match = Match.objects.create(
            team1=team1,
            team2=team2,
            overs=overs,
            players_per_team=max(len(team1_players), len(team2_players)),
            last_man_stands=last_man_stands,
            status='setup'
        )
        
        return Response(MatchSerializer(match).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='live')
    def live_state(self, request, pk=None):
        match = self.get_object()
        return Response(MatchLiveSerializer(match).data)

    @action(detail=True, methods=['post'], url_path='start-innings')
    def start_innings(self, request, pk=None):
        match = Match.objects.get(id=pk)
        innings_no = request.data.get('innings_no')
        batting_team_id = request.data.get('batting_team_id')
        
        batting_team = Team.objects.get(id=batting_team_id)
        bowling_team = match.team2 if batting_team == match.team1 else match.team1
        
        target = None
        if innings_no == 2:
            first_innings = match.innings.get(innings_no=1)
            target = first_innings.total_runs + 1
            
        innings = Innings.objects.create(
            match=match,
            innings_no=innings_no,
            batting_team=batting_team,
            bowling_team=bowling_team,
            target=target
        )
        
        match.current_innings_no = innings_no
        match.status = 'live'
        match.save()
        
        return Response(MatchLiveSerializer(match).data)

class InningsViewSet(viewsets.GenericViewSet):
    queryset = Innings.objects.all()

    @action(detail=True, methods=['post'], url_path='ball')
    def record_ball(self, request, pk=None):
        innings_id = pk
        try:
            ball = record_ball(innings_id, request.data)
            return Response(MatchLiveSerializer(self.get_object()).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='undo')
    def undo_ball(self, request, pk=None):
        innings_id = pk
        try:
            success = undo_ball(innings_id)
            return Response(MatchLiveSerializer(self.get_object()).data)
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
        
        return Response(MatchLiveSerializer(self.get_object()).data)

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
        
        return Response(MatchLiveSerializer(self.get_object()).data)
