from django.db import models
from django.contrib.auth.models import User
import uuid


class Tournament(models.Model):
    STATUS_CHOICES = [
        ('setup', 'Setup'),
        ('live', 'Live'),
        ('completed', 'Completed'),
    ]
    FORMAT_CHOICES = [
        ('league', 'League'),
        ('knockout', 'Knockout'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_tournaments')
    name = models.CharField(max_length=255)
    format = models.CharField(max_length=20, choices=FORMAT_CHOICES, default='league')
    overs_per_match = models.IntegerField(default=20)
    players_per_team = models.IntegerField(default=11)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='setup')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Team(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='teams', null=True, blank=True)
    
    def __str__(self):
        return self.name

class Player(models.Model):
    ROLE_CHOICES = [
        ('batsman', 'Batsman'),
        ('bowler', 'Bowler'),
        ('all_rounder', 'All Rounder'),
        ('wicket_keeper', 'Wicket Keeper'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='players')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='batsman')

    def __str__(self):
        return f"{self.name} ({self.team.name})"

class Match(models.Model):
    STATUS_CHOICES = [
        ('setup', 'Setup'),
        ('toss', 'Toss'),
        ('live', 'Live'),
        ('innings_break', 'Innings Break'),
        ('completed', 'Completed'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='matches', null=True, blank=True)
    team1 = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='matches_as_team1')
    team2 = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='matches_as_team2')
    overs = models.IntegerField(default=20)
    players_per_team = models.IntegerField(default=11)
    last_man_stands = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='setup')
    current_innings_no = models.IntegerField(default=0) # 0: not started, 1: first, 2: second
    winner = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name='matches_won')
    toss_winner = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name='tosses_won')
    toss_decision = models.CharField(max_length=10, choices=[('bat', 'Bat'), ('bowl', 'Bowl')], null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.team1.name} vs {self.team2.name}"

    @property
    def team1_score(self):
        inn = self.innings.filter(batting_team=self.team1).first()
        return inn.total_runs if inn else 0

    @property
    def team2_score(self):
        inn = self.innings.filter(batting_team=self.team2).first()
        return inn.total_runs if inn else 0

    @property
    def winner_name(self):
        return self.winner.name if self.winner else None

class Innings(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='innings')
    batting_team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='innings_batting')
    bowling_team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='innings_bowling')
    innings_no = models.IntegerField()
    total_runs = models.IntegerField(default=0)
    total_wickets = models.IntegerField(default=0)
    total_balls = models.IntegerField(default=0) # Legal balls
    total_extras = models.IntegerField(default=0)
    target = models.IntegerField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)

    class Meta:
        unique_together = ('match', 'innings_no')

class BattingScore(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    innings = models.ForeignKey(Innings, on_delete=models.CASCADE, related_name='batting_scores')
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    runs = models.IntegerField(default=0)
    balls_faced = models.IntegerField(default=0)
    fours = models.IntegerField(default=0)
    sixes = models.IntegerField(default=0)
    is_out = models.BooleanField(default=False)
    wicket_type = models.CharField(max_length=50, null=True, blank=True)
    dismissed_by = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True, related_name='wickets_taken_batting')
    is_at_crease = models.BooleanField(default=False)
    is_striker = models.BooleanField(default=False)

class BowlingScore(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    innings = models.ForeignKey(Innings, on_delete=models.CASCADE, related_name='bowling_scores')
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    balls_bowled = models.IntegerField(default=0)
    runs_conceded = models.IntegerField(default=0)
    wickets = models.IntegerField(default=0)
    maidens = models.IntegerField(default=0)
    is_current = models.BooleanField(default=False)

class BallEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    innings = models.ForeignKey(Innings, on_delete=models.CASCADE, related_name='balls')
    ball_no = models.IntegerField() # Over-relative ball count or global? Let's use global sequence.
    over_no = models.IntegerField()
    striker = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='balls_faced')
    non_striker = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='balls_at_non_striker')
    bowler = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='balls_bowled')
    runs_scored = models.IntegerField(default=0) # Runs off the bat
    extras_runs = models.IntegerField(default=0)
    extras_type = models.CharField(max_length=20, choices=[('wd', 'Wide'), ('nb', 'No Ball'), ('lb', 'Leg Bye'), ('b', 'Bye'), ('penalty', 'Penalty')], null=True, blank=True)
    is_wicket = models.BooleanField(default=False)
    wicket_type = models.CharField(max_length=50, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']


class UserProfile(models.Model):
    ADMIN = 'admin'
    MANAGER = 'manager'
    SCOREKEEPER = 'scorekeeper'
    USER = 'user'

    USER_TYPE_CHOICES = [
        (ADMIN, 'Admin'),
        (MANAGER, 'Manager'),
        (SCOREKEEPER, 'Scorekeeper'),
        (USER, 'User'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES, default=USER)

    def __str__(self):
        return f"{self.user.username} ({self.get_user_type_display()})"

    @property
    def can_manage_tournaments(self):
        return self.user_type in {self.ADMIN, self.MANAGER}

    @property
    def can_score_matches(self):
        return self.user_type in {self.ADMIN, self.SCOREKEEPER}

    @property
    def can_review_scorekeeper_requests(self):
        return self.user_type in {self.ADMIN, self.MANAGER}


class ScorekeeperRequest(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='scorekeeper_requests')
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_scorekeeper_requests')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    message = models.CharField(max_length=255, blank=True)
    review_note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} scorekeeper request ({self.get_status_display()})"
