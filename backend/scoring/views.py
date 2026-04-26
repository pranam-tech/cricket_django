from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Match, Team, Player, Innings, BattingScore, BowlingScore, BallEvent
from .serializers import MatchSerializer, MatchListSerializer, MatchLiveSerializer
from .logic import record_ball, undo_ball


def bad_request(message):
    return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)


def get_team_for_match(match, team_id):
    if team_id == str(match.team1_id):
        return match.team1, match.team2
    if team_id == str(match.team2_id):
        return match.team2, match.team1
    return None, None


def get_match_player(match, player_id, *, team=None):
    queryset = Player.objects.filter(id=player_id)
    if team is not None:
        queryset = queryset.filter(team=team)
    else:
        queryset = queryset.filter(team__in=[match.team1, match.team2])
    return queryset.first()

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

        team1_name = str(request.data.get('team1_name', 'Team A')).strip()
        team2_name = str(request.data.get('team2_name', 'Team B')).strip()
        team1_players = [str(name).strip() for name in request.data.get('team1_players', []) if str(name).strip()]
        team2_players = [str(name).strip() for name in request.data.get('team2_players', []) if str(name).strip()]
        last_man_stands = bool(request.data.get('last_man_stands', False))

        try:
            overs = int(request.data.get('overs', 20))
        except (TypeError, ValueError):
            return bad_request('Overs must be a whole number.')

        if not team1_name or not team2_name:
            return bad_request('Team names are required.')
        if team1_name == team2_name:
            return bad_request('Team names must be different.')
        if overs < 1:
            return bad_request('Match must have at least 1 over.')
        if len(team1_players) < 2 or len(team2_players) < 2:
            return bad_request('Both teams must have at least 2 players.')

        try:
            with transaction.atomic():
                team1 = Team.objects.create(name=team1_name)
                team2 = Team.objects.create(name=team2_name)
                
                players_to_create = []
                for name in team1_players:
                    players_to_create.append(Player(name=name, team=team1))
                for name in team2_players:
                    players_to_create.append(Player(name=name, team=team2))
                
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

        try:
            innings_no = int(request.data.get('innings_no'))
        except (TypeError, ValueError):
            return bad_request('Innings number must be 1 or 2.')

        if innings_no not in [1, 2]:
            return bad_request('Innings number must be 1 or 2.')
        if match.innings.filter(innings_no=innings_no).exists():
            return bad_request(f'Innings {innings_no} has already started.')

        batting_team_id = str(request.data.get('batting_team_id'))
        batting_team, bowling_team = get_team_for_match(match, batting_team_id)
        if batting_team is None:
            return bad_request('Batting team must be one of the teams in this match.')
        
        target = None
        if innings_no == 2:
            first_innings = match.innings.filter(innings_no=1).first()
            if first_innings is None or not first_innings.is_completed:
                return bad_request('First innings must be completed before starting the second innings.')
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
        player = get_match_player(innings.match, player_id, team=innings.batting_team)
        if player is None:
            return bad_request('Selected batsman is not part of the batting team.')

        if BattingScore.objects.filter(innings=innings, player=player).exists():
            return bad_request('Selected batsman is already part of this innings.')

        # If a striker already exists, the new player becomes the non-striker.
        # Otherwise, the new player becomes the striker.
        last_ball = BallEvent.objects.filter(innings=innings).last()
        over_ended_on_wicket = bool(
            last_ball and
            last_ball.is_wicket and
            last_ball.extras_type not in ['wd', 'nb'] and
            innings.total_balls > 0 and
            innings.total_balls % 6 == 0
        )

        if over_ended_on_wicket:
            BattingScore.objects.filter(innings=innings, is_at_crease=True).update(is_striker=False)
            current_batter = BattingScore.objects.filter(innings=innings, is_at_crease=True).first()
            if current_batter:
                current_batter.is_striker = True
                current_batter.save(update_fields=['is_striker'])
            new_batter_is_striker = False
        else:
            new_batter_is_striker = not BattingScore.objects.filter(
                innings=innings,
                is_at_crease=True,
                is_striker=True
            ).exists()

        BattingScore.objects.update_or_create(
            innings=innings, 
            player=player, 
            defaults={'is_at_crease': True, 'is_striker': new_batter_is_striker}
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
        player = get_match_player(innings.match, player_id, team=innings.bowling_team)
        if player is None:
            return bad_request('Selected bowler is not part of the bowling team.')
        
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
