import os
import django
import uuid
from datetime import timedelta
from django.utils import timezone

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cricket_backend.settings')
django.setup()

from scoring.models import Team, Player, Match, Innings, BattingScore, BowlingScore, BallEvent

def seed():
    print("Clearing existing data...")
    Match.objects.all().delete()
    Team.objects.all().delete()
    Player.objects.all().delete()

    print("Creating teams and players...")
    teams_data = {
        "Warriors": ["Rohit Sharma", "Virat Kohli", "Shubman Gill", "Suryakumar Yadav", "KL Rahul", "Hardik Pandya", "Ravindra Jadeja", "Jasprit Bumrah", "Mohammed Shami", "Mohammed Siraj", "Kuldeep Yadav"],
        "Titans": ["David Warner", "Travis Head", "Mitchell Marsh", "Steven Smith", "Marnus Labuschagne", "Glenn Maxwell", "Josh Inglis", "Pat Cummins", "Mitchell Starc", "Adam Zampa", "Josh Hazlewood"],
        "Strikers": ["Jos Buttler", "Phil Salt", "Will Jacks", "Jonny Bairstow", "Harry Brook", "Liam Livingstone", "Moeen Ali", "Sam Curran", "Adil Rashid", "Jofra Archer", "Mark Wood"],
        "Lions": ["Babar Azam", "Mohammad Rizwan", "Saim Ayub", "Fakhar Zaman", "Iftikhar Ahmed", "Azam Khan", "Imad Wasim", "Shaheen Afridi", "Naseem Shah", "Mohammad Amir", "Abrar Ahmed"]
    }

    teams = {}
    for team_name, players in teams_data.items():
        team = Team.objects.create(name=team_name)
        teams[team_name] = team
        for p_name in players:
            Player.objects.create(name=p_name, team=team)

    print("Creating a completed match (Warriors vs Titans)...")
    match1 = Match.objects.create(
        team1=teams["Warriors"],
        team2=teams["Titans"],
        overs=20,
        players_per_team=11,
        status='completed',
        current_innings_no=2,
        winner=teams["Warriors"]
    )
    
    # Add some basic innings data for the completed match
    Innings.objects.create(
        match=match1, innings_no=1, batting_team=teams["Titans"], bowling_team=teams["Warriors"],
        total_runs=182, total_wickets=8, total_balls=120, is_completed=True
    )
    Innings.objects.create(
        match=match1, innings_no=2, batting_team=teams["Warriors"], bowling_team=teams["Titans"],
        total_runs=185, total_wickets=4, total_balls=116, target=183, is_completed=True
    )

    print("Creating a live match (Strikers vs Lions)...")
    match2 = Match.objects.create(
        team1=teams["Strikers"],
        team2=teams["Lions"],
        overs=20,
        players_per_team=11,
        status='live',
        current_innings_no=1
    )
    
    inn2 = Innings.objects.create(
        match=match2, innings_no=1, batting_team=teams["Strikers"], bowling_team=teams["Lions"],
        total_runs=45, total_wickets=2, total_balls=34
    )
    
    # Set up some active batsmen and bowler for the live match
    p1 = Player.objects.filter(team=teams["Strikers"])[0]
    p2 = Player.objects.filter(team=teams["Strikers"])[1]
    b1 = Player.objects.filter(team=teams["Lions"])[7]
    
    BattingScore.objects.create(innings=inn2, player=p1, runs=24, balls_faced=18, is_at_crease=True, is_striker=True)
    BattingScore.objects.create(innings=inn2, player=p2, runs=12, balls_faced=10, is_at_crease=True, is_striker=False)
    BowlingScore.objects.create(innings=inn2, player=b1, balls_bowled=16, runs_conceded=18, wickets=1, is_current=True)

    print("Creating a setup match (Titans vs Strikers)...")
    Match.objects.create(
        team1=teams["Titans"],
        team2=teams["Strikers"],
        overs=20,
        players_per_team=11,
        status='setup'
    )

    print("Seed data created successfully!")

if __name__ == "__main__":
    seed()
