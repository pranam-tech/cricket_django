from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    Tournament,
    Team,
    Player,
    Match,
    Innings,
    BattingScore,
    BowlingScore,
    BallEvent,
    UserProfile,
    ScorekeeperRequest,
)


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    extra = 0
    fields = ('user_type',)


admin.site.unregister(User)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    list_display = BaseUserAdmin.list_display + ('get_user_type',)

    @admin.display(description='User type')
    def get_user_type(self, obj):
        return getattr(obj.profile, 'get_user_type_display', lambda: '-')()

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


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'user_type')
    list_filter = ('user_type',)
    search_fields = ('user__username', 'user__email', 'user__first_name', 'user__last_name')


@admin.register(ScorekeeperRequest)
class ScorekeeperRequestAdmin(admin.ModelAdmin):
    list_display = ('user', 'status', 'reviewed_by', 'created_at', 'updated_at')
    list_filter = ('status', 'created_at')
    search_fields = ('user__username', 'user__email', 'message', 'review_note')
