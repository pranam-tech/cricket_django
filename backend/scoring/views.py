from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Count, Prefetch, Q
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .logic import record_ball, undo_ball
from .models import (
    Match,
    Team,
    Player,
    Innings,
    BattingScore,
    BowlingScore,
    BallEvent,
    Tournament,
    ScorekeeperRequest,
    UserProfile,
)
from .permissions import AuthenticatedReadOnlyOrManager, CanScoreLiveMatches, IsManagerOrAdmin
from .serializers import (
    AdminPromoteScorekeeperToManagerSerializer,
    AdminPromoteUserSerializer,
    LoginSerializer,
    MatchListSerializer,
    MatchLiveSerializer,
    MatchSerializer,
    RegisterSerializer,
    ScorekeeperRequestCreateSerializer,
    ScorekeeperRequestReviewSerializer,
    ScorekeeperRequestSerializer,
    TournamentCreateSerializer,
    TournamentDetailSerializer,
    TournamentListSerializer,
    UserSerializer,
)


def bad_request(message):
    return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)


def user_payload(user):
    token, _ = Token.objects.get_or_create(user=user)
    return {
        'token': token.key,
        'user': UserSerializer(user).data,
    }


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


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(user_payload(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password'],
        )
        if not user:
            return Response({'error': 'Invalid username or password.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(user_payload(user))


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class AdminPromotionView(APIView):
    permission_classes = [IsAuthenticated, IsManagerOrAdmin]

    def post(self, request):
        if request.user.profile.user_type != UserProfile.ADMIN:
            return Response({'error': 'Only admins can perform promotions.'}, status=status.HTTP_403_FORBIDDEN)

        action = request.data.get('action')
        if action == 'scorekeeper_to_manager':
            serializer = AdminPromoteScorekeeperToManagerSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            target_user = serializer.context['target_user']
            target_user.profile.user_type = UserProfile.MANAGER
            target_user.profile.save(update_fields=['user_type'])
            return Response({'user': UserSerializer(target_user).data})

        if action == 'user_promotion':
            serializer = AdminPromoteUserSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            target_user = serializer.context['target_user']
            target_user.profile.user_type = serializer.validated_data['target_role']
            target_user.profile.save(update_fields=['user_type'])
            return Response({'user': UserSerializer(target_user).data})

        return bad_request('Invalid action. Use "scorekeeper_to_manager" or "user_promotion".')


class TournamentViewSet(viewsets.ModelViewSet):
    permission_classes = [AuthenticatedReadOnlyOrManager]

    def get_queryset(self):
        return Tournament.objects.select_related('manager').annotate(
            matches_count=Count('matches', distinct=True),
            live_matches_count=Count('matches', filter=Q(matches__status='live'), distinct=True),
        ).prefetch_related(
            Prefetch('matches', queryset=Match.objects.select_related('team1', 'team2', 'tournament').order_by('-created_at'))
        ).order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return TournamentCreateSerializer
        if self.action == 'retrieve':
            return TournamentDetailSerializer
        return TournamentListSerializer

    def perform_create(self, serializer):
        serializer.save(manager=self.request.user)


class MatchViewSet(viewsets.ModelViewSet):
    permission_classes = [AuthenticatedReadOnlyOrManager]
    queryset = Match.objects.all().order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'list':
            return MatchListSerializer
        return MatchSerializer

    def get_queryset(self):
        queryset = Match.objects.select_related('team1', 'team2', 'tournament').all().order_by('-created_at')
        tournament_id = self.request.query_params.get('tournament')
        if tournament_id:
            queryset = queryset.filter(tournament_id=tournament_id)
        if self.action in ['retrieve', 'live_state', 'start_innings', 'record_ball', 'undo_ball', 'next_batsman', 'next_bowler']:
            queryset = queryset.select_related('winner').prefetch_related(
                'innings__batting_team__players',
                'innings__bowling_team__players',
                'innings__batting_scores__player',
                'innings__bowling_scores__player',
                'innings__balls__bowler'
            )
        return queryset

    @action(detail=False, methods=['post'], url_path='quick', permission_classes=[IsAuthenticated, IsManagerOrAdmin])
    def quick_match(self, request):
        team1_name = str(request.data.get('team1_name', 'Team A')).strip()
        team2_name = str(request.data.get('team2_name', 'Team B')).strip()
        team1_players = [str(name).strip() for name in request.data.get('team1_players', []) if str(name).strip()]
        team2_players = [str(name).strip() for name in request.data.get('team2_players', []) if str(name).strip()]
        last_man_stands = bool(request.data.get('last_man_stands', False))
        tournament_id = request.data.get('tournament_id')

        try:
            overs = int(request.data.get('overs', 20))
        except (TypeError, ValueError):
            return bad_request('Overs must be a whole number.')

        if not tournament_id:
            return bad_request('Tournament is required.')

        tournament = Tournament.objects.filter(id=tournament_id).first()
        if tournament is None:
            return bad_request('Tournament not found.')
        if not request.user.profile.can_manage_tournaments:
            return Response(status=status.HTTP_403_FORBIDDEN)
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
                team1 = Team.objects.create(name=team1_name, tournament=tournament)
                team2 = Team.objects.create(name=team2_name, tournament=tournament)

                players_to_create = []
                for name in team1_players:
                    players_to_create.append(Player(name=name, team=team1))
                for name in team2_players:
                    players_to_create.append(Player(name=name, team=team2))

                Player.objects.bulk_create(players_to_create)

                match = Match.objects.create(
                    tournament=tournament,
                    team1=team1,
                    team2=team2,
                    overs=overs,
                    players_per_team=max(len(team1_players), len(team2_players)),
                    last_man_stands=last_man_stands,
                    status='setup'
                )
                if tournament.matches.exclude(status='completed').exists():
                    tournament.status = 'live'
                    tournament.save(update_fields=['status'])

            return Response(MatchLiveSerializer(match).data, status=status.HTTP_201_CREATED)
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='live', permission_classes=[IsAuthenticated])
    def live_state(self, request, pk=None):
        match = self.get_object()
        return Response(MatchLiveSerializer(match).data)

    @action(detail=True, methods=['post'], url_path='start-innings', permission_classes=[IsAuthenticated, CanScoreLiveMatches])
    def start_innings(self, request, pk=None):
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
        match.save(update_fields=['current_innings_no', 'status'])

        if match.tournament and match.tournament.status != 'live':
            match.tournament.status = 'live'
            match.tournament.save(update_fields=['status'])

        match = self.get_object()
        return Response(MatchLiveSerializer(match).data)


class InningsViewSet(viewsets.GenericViewSet):
    queryset = Innings.objects.all()
    permission_classes = [CanScoreLiveMatches]

    @action(detail=True, methods=['post'], url_path='ball')
    def record_ball(self, request, pk=None):
        innings_id = pk
        try:
            record_ball(innings_id, request.data)
            match = Match.objects.select_related('team1', 'team2', 'tournament').prefetch_related(
                'innings__batting_scores__player',
                'innings__bowling_scores__player',
                'innings__balls__bowler'
            ).get(innings__id=innings_id)
            return Response(MatchLiveSerializer(match).data)
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='undo')
    def undo_ball(self, request, pk=None):
        innings_id = pk
        try:
            undo_ball(innings_id)
            match = Match.objects.select_related('team1', 'team2', 'tournament').prefetch_related(
                'innings__batting_scores__player',
                'innings__bowling_scores__player',
                'innings__balls__bowler'
            ).get(innings__id=innings_id)
            return Response(MatchLiveSerializer(match).data)
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='next-batsman')
    def next_batsman(self, request, pk=None):
        innings = self.get_object()
        player_id = request.data.get('player_id')
        player = get_match_player(innings.match, player_id, team=innings.batting_team)
        if player is None:
            return bad_request('Selected batsman is not part of the batting team.')

        if BattingScore.objects.filter(innings=innings, player=player).exists():
            return bad_request('Selected batsman is already part of this innings.')

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

        match = Match.objects.select_related('team1', 'team2', 'tournament').prefetch_related(
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

        last_ball = BallEvent.objects.filter(innings=innings).last()
        if last_ball and last_ball.bowler == player and innings.total_balls % 6 == 0 and innings.total_balls > 0:
            return Response({"error": "This bowler just finished an over and cannot bowl consecutive overs."}, status=status.HTTP_400_BAD_REQUEST)

        BowlingScore.objects.filter(innings=innings, is_current=True).update(is_current=False)
        score, _ = BowlingScore.objects.get_or_create(innings=innings, player=player)
        score.is_current = True
        score.save(update_fields=['is_current'])

        match = Match.objects.select_related('team1', 'team2', 'tournament').prefetch_related(
            'innings__batting_scores__player',
            'innings__bowling_scores__player',
            'innings__balls__bowler'
        ).get(innings=innings)
        return Response(MatchLiveSerializer(match).data)


class ScorekeeperRequestViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    queryset = ScorekeeperRequest.objects.select_related('user', 'reviewed_by', 'user__profile', 'reviewed_by__profile')

    def list(self, request):
        if request.user.profile.can_review_scorekeeper_requests:
            queryset = self.get_queryset()
        else:
            queryset = self.get_queryset().filter(user=request.user)
        return Response(ScorekeeperRequestSerializer(queryset, many=True).data)

    def create(self, request):
        serializer = ScorekeeperRequestCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        scorekeeper_request = ScorekeeperRequest.objects.create(
            user=request.user,
            message=serializer.validated_data.get('message', '')
        )
        return Response(ScorekeeperRequestSerializer(scorekeeper_request).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsManagerOrAdmin])
    def approve(self, request, pk=None):
        scorekeeper_request = self.get_object()
        if scorekeeper_request.status != ScorekeeperRequest.STATUS_PENDING:
            return bad_request('This request has already been reviewed.')

        serializer = ScorekeeperRequestReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        scorekeeper_request.status = ScorekeeperRequest.STATUS_APPROVED
        scorekeeper_request.reviewed_by = request.user
        scorekeeper_request.review_note = serializer.validated_data.get('review_note', '')
        scorekeeper_request.save(update_fields=['status', 'reviewed_by', 'review_note', 'updated_at'])

        profile = scorekeeper_request.user.profile
        profile.user_type = UserProfile.SCOREKEEPER
        profile.save(update_fields=['user_type'])

        return Response(ScorekeeperRequestSerializer(scorekeeper_request).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsManagerOrAdmin])
    def reject(self, request, pk=None):
        scorekeeper_request = self.get_object()
        if scorekeeper_request.status != ScorekeeperRequest.STATUS_PENDING:
            return bad_request('This request has already been reviewed.')

        serializer = ScorekeeperRequestReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        scorekeeper_request.status = ScorekeeperRequest.STATUS_REJECTED
        scorekeeper_request.reviewed_by = request.user
        scorekeeper_request.review_note = serializer.validated_data.get('review_note', '')
        scorekeeper_request.save(update_fields=['status', 'reviewed_by', 'review_note', 'updated_at'])

        return Response(ScorekeeperRequestSerializer(scorekeeper_request).data)
