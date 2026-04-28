from django.contrib.auth.models import User
from rest_framework import serializers

from .models import (
    Tournament,
    Team,
    Player,
    Match,
    Innings,
    BallEvent,
    BattingScore,
    BowlingScore,
    UserProfile,
    ScorekeeperRequest,
)


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['user_type']


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'profile']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password']

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Username is already taken.')
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = '__all__'


class TeamSerializer(serializers.ModelSerializer):
    players = PlayerSerializer(many=True, read_only=True)

    class Meta:
        model = Team
        fields = '__all__'


class BattingScoreSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.name', read_only=True)

    class Meta:
        model = BattingScore
        fields = '__all__'


class BowlingScoreSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.name', read_only=True)

    class Meta:
        model = BowlingScore
        fields = '__all__'


class BallEventSerializer(serializers.ModelSerializer):
    bowler_name = serializers.CharField(source='bowler.name', read_only=True)

    class Meta:
        model = BallEvent
        fields = '__all__'


class InningsSerializer(serializers.ModelSerializer):
    batting_scores = BattingScoreSerializer(many=True, read_only=True)
    bowling_scores = BowlingScoreSerializer(many=True, read_only=True)
    balls = BallEventSerializer(many=True, read_only=True)
    batting_team_name = serializers.CharField(source='batting_team.name', read_only=True)
    bowling_team_name = serializers.CharField(source='bowling_team.name', read_only=True)
    batting_team_players = PlayerSerializer(source='batting_team.players', many=True, read_only=True)
    bowling_team_players = PlayerSerializer(source='bowling_team.players', many=True, read_only=True)

    class Meta:
        model = Innings
        fields = [
            'id',
            'match',
            'innings_no',
            'batting_team',
            'bowling_team',
            'target',
            'total_runs',
            'total_wickets',
            'total_balls',
            'is_completed',
            'batting_scores',
            'bowling_scores',
            'balls',
            'batting_team_name',
            'bowling_team_name',
            'batting_team_players',
            'bowling_team_players',
        ]


class MatchSerializer(serializers.ModelSerializer):
    team1_name = serializers.CharField(source='team1.name', read_only=True)
    team2_name = serializers.CharField(source='team2.name', read_only=True)
    innings = InningsSerializer(many=True, read_only=True)
    tournament_name = serializers.CharField(source='tournament.name', read_only=True)

    class Meta:
        model = Match
        fields = [
            'id',
            'tournament',
            'tournament_name',
            'team1',
            'team2',
            'team1_name',
            'team2_name',
            'overs',
            'players_per_team',
            'last_man_stands',
            'status',
            'current_innings_no',
            'winner',
            'winner_name',
            'team1_score',
            'team2_score',
            'innings',
            'created_at',
        ]


class MatchListSerializer(serializers.ModelSerializer):
    team1_name = serializers.CharField(source='team1.name', read_only=True)
    team2_name = serializers.CharField(source='team2.name', read_only=True)
    tournament_name = serializers.CharField(source='tournament.name', read_only=True)

    class Meta:
        model = Match
        fields = ['id', 'tournament', 'tournament_name', 'team1_name', 'team2_name', 'status', 'created_at']


class MatchLiveSerializer(serializers.ModelSerializer):
    current_innings_data = serializers.SerializerMethodField()
    team1_name = serializers.CharField(source='team1.name', read_only=True)
    team2_name = serializers.CharField(source='team2.name', read_only=True)
    tournament_name = serializers.CharField(source='tournament.name', read_only=True)

    class Meta:
        model = Match
        fields = [
            'id',
            'status',
            'current_innings_no',
            'tournament',
            'tournament_name',
            'team1',
            'team2',
            'team1_name',
            'team2_name',
            'current_innings_data',
            'team1_score',
            'team2_score',
            'winner',
            'winner_name',
            'last_man_stands',
            'overs',
            'players_per_team',
        ]

    def get_current_innings_data(self, obj):
        if obj.current_innings_no > 0:
            innings_list = [i for i in obj.innings.all() if i.innings_no == obj.current_innings_no]
            innings = innings_list[0] if innings_list else None
            if innings:
                return InningsSerializer(innings).data
        return None


class TournamentListSerializer(serializers.ModelSerializer):
    manager_name = serializers.SerializerMethodField()
    matches_count = serializers.IntegerField(read_only=True)
    live_matches_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tournament
        fields = [
            'id',
            'name',
            'format',
            'overs_per_match',
            'players_per_team',
            'status',
            'manager',
            'manager_name',
            'matches_count',
            'live_matches_count',
            'created_at',
        ]

    def get_manager_name(self, obj):
        return obj.manager.get_full_name() or obj.manager.username if obj.manager else None


class TournamentDetailSerializer(TournamentListSerializer):
    matches = MatchListSerializer(many=True, read_only=True)

    class Meta(TournamentListSerializer.Meta):
        fields = TournamentListSerializer.Meta.fields + ['matches']


class TournamentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tournament
        fields = ['id', 'name', 'format', 'overs_per_match', 'players_per_team']


class ScorekeeperRequestSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    reviewed_by = UserSerializer(read_only=True)

    class Meta:
        model = ScorekeeperRequest
        fields = [
            'id',
            'user',
            'reviewed_by',
            'status',
            'message',
            'review_note',
            'created_at',
            'updated_at',
        ]


class ScorekeeperRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScorekeeperRequest
        fields = ['message']

    def validate(self, attrs):
        user = self.context['request'].user
        if user.profile.user_type not in {UserProfile.USER, UserProfile.ADMIN}:
            raise serializers.ValidationError('Only users or admins can request scorekeeper access.')
        if ScorekeeperRequest.objects.filter(user=user, status=ScorekeeperRequest.STATUS_PENDING).exists():
            raise serializers.ValidationError('You already have a pending request.')
        return attrs


class ScorekeeperRequestReviewSerializer(serializers.Serializer):
    review_note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class AdminPromoteScorekeeperToManagerSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()

    def validate_user_id(self, value):
        user = User.objects.filter(id=value).select_related('profile').first()
        if user is None:
            raise serializers.ValidationError('User not found.')
        if user.profile.user_type != UserProfile.SCOREKEEPER:
            raise serializers.ValidationError('Only scorekeepers can be promoted to manager.')
        self.context['target_user'] = user
        return value


class AdminPromoteUserSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    target_role = serializers.ChoiceField(choices=[UserProfile.SCOREKEEPER, UserProfile.MANAGER])

    def validate(self, attrs):
        user = User.objects.filter(id=attrs['user_id']).select_related('profile').first()
        if user is None:
            raise serializers.ValidationError({'user_id': 'User not found.'})
        if user.profile.user_type != UserProfile.USER:
            raise serializers.ValidationError({'user_id': 'Only regular users can be promoted through this action.'})
        self.context['target_user'] = user
        return attrs
