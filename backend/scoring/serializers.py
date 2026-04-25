from rest_framework import serializers
from .models import Tournament, Team, Player, Match, Innings, BallEvent, BattingScore, BowlingScore

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
        fields = ['id', 'match', 'innings_no', 'batting_team', 'bowling_team', 'target', 'total_runs', 'total_wickets', 'total_balls', 'is_completed', 'batting_scores', 'bowling_scores', 'balls', 'batting_team_name', 'bowling_team_name', 'batting_team_players', 'bowling_team_players']

class MatchSerializer(serializers.ModelSerializer):
    team1_name = serializers.CharField(source='team1.name', read_only=True)
    team2_name = serializers.CharField(source='team2.name', read_only=True)
    innings = InningsSerializer(many=True, read_only=True)
    
    class Meta:
        model = Match
        fields = ['id', 'team1', 'team2', 'team1_name', 'team2_name', 'overs', 'players_per_team', 'last_man_stands', 'status', 'current_innings_no', 'winner', 'winner_name', 'team1_score', 'team2_score', 'innings', 'created_at']

class MatchListSerializer(serializers.ModelSerializer):
    team1_name = serializers.CharField(source='team1.name', read_only=True)
    team2_name = serializers.CharField(source='team2.name', read_only=True)
    
    class Meta:
        model = Match
        fields = ['id', 'team1_name', 'team2_name', 'status', 'created_at']

class MatchLiveSerializer(serializers.ModelSerializer):
    current_innings_data = serializers.SerializerMethodField()
    team1_name = serializers.CharField(source='team1.name', read_only=True)
    team2_name = serializers.CharField(source='team2.name', read_only=True)

    class Meta:
        model = Match
        fields = ['id', 'status', 'current_innings_no', 'team1', 'team2', 'team1_name', 'team2_name', 'current_innings_data', 'team1_score', 'team2_score', 'winner', 'winner_name', 'last_man_stands', 'overs', 'players_per_team']

    def get_current_innings_data(self, obj):
        if obj.current_innings_no > 0:
            # Look in prefetched innings to avoid a DB hit
            innings_list = [i for i in obj.innings.all() if i.innings_no == obj.current_innings_no]
            innings = innings_list[0] if innings_list else None
            if innings:
                return InningsSerializer(innings).data
        return None
