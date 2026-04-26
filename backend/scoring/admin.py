from django.contrib import admin
from .models import Tournament, Team, Player, Match, Innings, BattingScore, BowlingScore, BallEvent

@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ('name', 'format', 'status', 'created_at')
    search_fields = ('name',)

@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('name', 'tournament')
    search_fields = ('name',)

@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ('name', 'team', 'role')
    list_filter = ('team', 'role')
    search_fields = ('name',)

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ('team1', 'team2', 'status', 'current_innings_no', 'winner', 'created_at')
    list_filter = ('status', 'tournament')
    search_fields = ('team1__name', 'team2__name')

@admin.register(Innings)
class InningsAdmin(admin.ModelAdmin):
    list_display = ('match', 'innings_no', 'batting_team', 'total_runs', 'total_wickets', 'is_completed')
    list_filter = ('innings_no', 'is_completed')

@admin.register(BattingScore)
class BattingScoreAdmin(admin.ModelAdmin):
    list_display = ('player', 'innings', 'runs', 'balls_faced', 'is_out', 'is_at_crease')
    list_filter = ('is_out', 'is_at_crease')

@admin.register(BowlingScore)
class BowlingScoreAdmin(admin.ModelAdmin):
    list_display = ('player', 'innings', 'balls_bowled', 'runs_conceded', 'wickets', 'is_current')
    list_filter = ('is_current',)

@admin.register(BallEvent)
class BallEventAdmin(admin.ModelAdmin):
    list_display = ('innings', 'over_no', 'bowler', 'striker', 'runs_scored', 'extras_type', 'is_wicket')
    list_filter = ('is_wicket', 'extras_type')
