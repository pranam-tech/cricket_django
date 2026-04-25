from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Match, Team, Player, Innings, BallEvent, BattingScore, BowlingScore
from .logic import record_ball, undo_ball

class ScoringLogicTest(TestCase):
    def setUp(self):
        self.team1 = Team.objects.create(name="Team A")
        self.team2 = Team.objects.create(name="Team B")
        self.p1 = Player.objects.create(name="Player 1", team=self.team1)
        self.p2 = Player.objects.create(name="Player 2", team=self.team1)
        self.b1 = Player.objects.create(name="Bowler 1", team=self.team2)
        
        self.match = Match.objects.create(
            team1=self.team1,
            team2=self.team2,
            overs=1,
            players_per_team=11
        )
        
        self.innings = Innings.objects.create(
            match=self.match,
            innings_no=1,
            batting_team=self.team1,
            bowling_team=self.team2
        )
        
        # Setup initial scores
        BattingScore.objects.create(innings=self.innings, player=self.p1, is_at_crease=True, is_striker=True)
        BattingScore.objects.create(innings=self.innings, player=self.p2, is_at_crease=True, is_striker=False)
        BowlingScore.objects.create(innings=self.innings, player=self.b1, is_current=True)

    def test_record_normal_ball(self):
        data = {
            'striker_id': str(self.p1.id),
            'non_striker_id': str(self.p2.id),
            'bowler_id': str(self.b1.id),
            'runs_scored': 1,
            'extras_type': None,
            'extras_runs': 0,
            'is_wicket': False
        }
        record_ball(self.innings.id, data)
        
        self.innings.refresh_from_db()
        self.assertEqual(self.innings.total_runs, 1)
        self.assertEqual(self.innings.total_balls, 1)
        
        # Check striker rotation (1 run should switch strike)
        s1 = BattingScore.objects.get(innings=self.innings, player=self.p1)
        s2 = BattingScore.objects.get(innings=self.innings, player=self.p2)
        self.assertFalse(s1.is_striker)
        self.assertTrue(s2.is_striker)

    def test_record_wide(self):
        data = {
            'striker_id': str(self.p1.id),
            'non_striker_id': str(self.p2.id),
            'bowler_id': str(self.b1.id),
            'runs_scored': 0,
            'extras_type': 'wd',
            'extras_runs': 1,
            'is_wicket': False
        }
        record_ball(self.innings.id, data)
        
        self.innings.refresh_from_db()
        self.assertEqual(self.innings.total_runs, 1)
        self.assertEqual(self.innings.total_balls, 0) # Wide doesn't count as legal ball

class MatchAPITest(APITestCase):
    def setUp(self):
        self.team1 = Team.objects.create(name="India")
        self.team2 = Team.objects.create(name="Australia")

    def test_create_quick_match(self):
        url = '/api/matches/quick/'
        data = {
            'team1_name': 'India',
            'team2_name': 'Australia',
            'team1_players': ['Rohit', 'Kohli'],
            'team2_players': ['Cummins', 'Starc'],
            'overs': 20
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Match.objects.count(), 1)
        self.assertEqual(Player.objects.count(), 4)
