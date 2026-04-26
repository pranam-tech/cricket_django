from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Match, Team, Player, Innings, BallEvent, BattingScore, BowlingScore, UserProfile, Tournament, ScorekeeperRequest
from .logic import record_ball, undo_ball


class UserProfileTest(TestCase):
    def test_first_user_becomes_manager(self):
        user = User.objects.create_user(username='captain', password='secret123')

        self.assertTrue(hasattr(user, 'profile'))
        self.assertEqual(user.profile.user_type, UserProfile.MANAGER)

    def test_second_regular_user_defaults_to_user(self):
        User.objects.create_user(username='manager', password='secret123')
        user = User.objects.create_user(username='scorer', password='secret123')

        self.assertEqual(user.profile.user_type, UserProfile.USER)

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

    def test_run_out_does_not_credit_bowler_in_batting_score(self):
        data = {
            'striker_id': str(self.p1.id),
            'non_striker_id': str(self.p2.id),
            'bowler_id': str(self.b1.id),
            'runs_scored': 0,
            'extras_type': None,
            'extras_runs': 0,
            'is_wicket': True,
            'wicket_type': 'run_out',
        }
        record_ball(self.innings.id, data)

        striker_score = BattingScore.objects.get(innings=self.innings, player=self.p1)
        bowler_score = BowlingScore.objects.get(innings=self.innings, player=self.b1)
        self.assertIsNone(striker_score.dismissed_by)
        self.assertEqual(bowler_score.wickets, 0)

    def test_undo_reopens_completed_innings(self):
        data = {
            'striker_id': str(self.p1.id),
            'non_striker_id': str(self.p2.id),
            'bowler_id': str(self.b1.id),
            'runs_scored': 0,
            'extras_type': None,
            'extras_runs': 0,
            'is_wicket': True,
            'wicket_type': 'bowled',
        }
        record_ball(self.innings.id, data)

        self.innings.refresh_from_db()
        self.match.refresh_from_db()
        self.assertTrue(self.innings.is_completed)
        self.assertEqual(self.match.status, 'innings_break')

        undo_ball(self.innings.id)

        self.innings.refresh_from_db()
        self.match.refresh_from_db()
        self.assertFalse(self.innings.is_completed)
        self.assertEqual(self.match.status, 'live')
        self.assertEqual(self.innings.total_wickets, 0)

    def test_last_man_stands_promotes_non_striker(self):
        third_player = Player.objects.create(name="Player 3", team=self.team1)
        lms_match = Match.objects.create(
            team1=self.team1,
            team2=self.team2,
            overs=1,
            players_per_team=3,
            last_man_stands=True,
        )
        lms_innings = Innings.objects.create(
            match=lms_match,
            innings_no=1,
            batting_team=self.team1,
            bowling_team=self.team2,
        )
        striker_score = BattingScore.objects.create(innings=lms_innings, player=self.p1, is_at_crease=True, is_striker=True)
        non_striker_score = BattingScore.objects.create(innings=lms_innings, player=self.p2, is_at_crease=True, is_striker=False)
        BattingScore.objects.create(innings=lms_innings, player=third_player, is_out=True)
        BowlingScore.objects.create(innings=lms_innings, player=self.b1, is_current=True)
        lms_innings.total_wickets = 1
        lms_innings.save(update_fields=['total_wickets'])

        record_ball(lms_innings.id, {
            'striker_id': str(self.p1.id),
            'non_striker_id': str(self.p2.id),
            'bowler_id': str(self.b1.id),
            'runs_scored': 0,
            'extras_type': None,
            'extras_runs': 0,
            'is_wicket': True,
            'wicket_type': 'bowled',
        })

        striker_score.refresh_from_db()
        non_striker_score.refresh_from_db()
        lms_innings.refresh_from_db()

        self.assertTrue(striker_score.is_out)
        self.assertFalse(striker_score.is_at_crease)
        self.assertTrue(non_striker_score.is_at_crease)
        self.assertTrue(non_striker_score.is_striker)
        self.assertFalse(lms_innings.is_completed)

    def test_second_innings_target_completion_and_undo(self):
        chaser = Team.objects.create(name="Team C")
        defender = Team.objects.create(name="Team D")
        striker = Player.objects.create(name="Chaser 1", team=chaser)
        non_striker = Player.objects.create(name="Chaser 2", team=chaser)
        bowler = Player.objects.create(name="Defender 1", team=defender)

        match = Match.objects.create(
            team1=defender,
            team2=chaser,
            overs=1,
            players_per_team=2,
            status='live',
            current_innings_no=2,
        )
        Innings.objects.create(
            match=match,
            innings_no=1,
            batting_team=defender,
            bowling_team=chaser,
            total_runs=5,
            is_completed=True,
        )
        chase = Innings.objects.create(
            match=match,
            innings_no=2,
            batting_team=chaser,
            bowling_team=defender,
            target=6,
        )
        BattingScore.objects.create(innings=chase, player=striker, is_at_crease=True, is_striker=True)
        BattingScore.objects.create(innings=chase, player=non_striker, is_at_crease=True, is_striker=False)
        BowlingScore.objects.create(innings=chase, player=bowler, is_current=True)

        record_ball(chase.id, {
            'striker_id': str(striker.id),
            'non_striker_id': str(non_striker.id),
            'bowler_id': str(bowler.id),
            'runs_scored': 6,
            'extras_type': None,
            'extras_runs': 0,
            'is_wicket': False,
        })

        chase.refresh_from_db()
        match.refresh_from_db()
        self.assertTrue(chase.is_completed)
        self.assertEqual(match.status, 'completed')
        self.assertEqual(match.winner, chaser)

        undo_ball(chase.id)

        chase.refresh_from_db()
        match.refresh_from_db()
        self.assertFalse(chase.is_completed)
        self.assertEqual(match.status, 'live')
        self.assertIsNone(match.winner)
        self.assertEqual(chase.total_runs, 0)

    def test_lms_undo_restores_both_batters(self):
        third_player = Player.objects.create(name="Player 3", team=self.team1)
        lms_match = Match.objects.create(
            team1=self.team1,
            team2=self.team2,
            overs=1,
            players_per_team=3,
            last_man_stands=True,
            status='live',
            current_innings_no=1,
        )
        lms_innings = Innings.objects.create(
            match=lms_match,
            innings_no=1,
            batting_team=self.team1,
            bowling_team=self.team2,
        )
        striker_score = BattingScore.objects.create(innings=lms_innings, player=self.p1, is_at_crease=True, is_striker=True)
        non_striker_score = BattingScore.objects.create(innings=lms_innings, player=self.p2, is_at_crease=True, is_striker=False)
        BattingScore.objects.create(innings=lms_innings, player=third_player, is_out=True)
        BowlingScore.objects.create(innings=lms_innings, player=self.b1, is_current=True)
        lms_innings.total_wickets = 1
        lms_innings.save(update_fields=['total_wickets'])

        record_ball(lms_innings.id, {
            'striker_id': str(self.p1.id),
            'non_striker_id': str(self.p2.id),
            'bowler_id': str(self.b1.id),
            'runs_scored': 0,
            'extras_type': None,
            'extras_runs': 0,
            'is_wicket': True,
            'wicket_type': 'bowled',
        })

        undo_ball(lms_innings.id)

        striker_score.refresh_from_db()
        non_striker_score.refresh_from_db()
        lms_innings.refresh_from_db()

        self.assertFalse(striker_score.is_out)
        self.assertTrue(striker_score.is_at_crease)
        self.assertTrue(striker_score.is_striker)
        self.assertTrue(non_striker_score.is_at_crease)
        self.assertFalse(non_striker_score.is_striker)
        self.assertEqual(lms_innings.total_wickets, 1)

class MatchAPITest(APITestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='manager_api', password='secret123')
        self.scorekeeper = User.objects.create_user(username='scorekeeper_api', password='secret123')
        self.scorekeeper.profile.user_type = UserProfile.SCOREKEEPER
        self.scorekeeper.profile.save(update_fields=['user_type'])
        self.user = User.objects.create_user(username='viewer_api', password='secret123')
        self.manager_token = Token.objects.create(user=self.manager)
        self.scorekeeper_token = Token.objects.create(user=self.scorekeeper)
        self.user_token = Token.objects.create(user=self.user)
        self.team1 = Team.objects.create(name="India")
        self.team2 = Team.objects.create(name="Australia")
        self.tournament = Tournament.objects.create(
            name='Summer Cup',
            format='league',
            overs_per_match=20,
            players_per_team=11,
            manager=self.manager,
        )

    def authenticate(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_create_quick_match(self):
        self.authenticate(self.manager_token)
        url = '/api/matches/quick/'
        data = {
            'tournament_id': str(self.tournament.id),
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

    def test_create_quick_match_rejects_duplicate_team_names(self):
        self.authenticate(self.manager_token)
        response = self.client.post('/api/matches/quick/', {
            'tournament_id': str(self.tournament.id),
            'team1_name': 'India',
            'team2_name': 'India',
            'team1_players': ['Rohit', 'Gill'],
            'team2_players': ['Cummins', 'Starc'],
            'overs': 20,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_regular_user_cannot_create_tournament(self):
        self.authenticate(self.user_token)
        response = self.client.post('/api/tournaments/', {
            'name': 'Unauthorized Cup',
            'format': 'league',
            'overs_per_match': 20,
            'players_per_team': 11,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_start_innings_rejects_invalid_team(self):
        self.authenticate(self.scorekeeper_token)
        match = Match.objects.create(team1=self.team1, team2=self.team2, overs=20, players_per_team=2)

        outsider_team = Team.objects.create(name="England")
        response = self.client.post(
            f'/api/matches/{match.id}/start-innings/',
            {'innings_no': 1, 'batting_team_id': str(outsider_team.id)},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_next_bowler_rejects_batsman_from_wrong_team(self):
        self.authenticate(self.scorekeeper_token)
        batter1 = Player.objects.create(name="Rohit", team=self.team1)
        batter2 = Player.objects.create(name="Gill", team=self.team1)
        wrong_bowler = Player.objects.create(name="Kohli", team=self.team1)
        Player.objects.create(name="Starc", team=self.team2)

        match = Match.objects.create(team1=self.team1, team2=self.team2, overs=20, players_per_team=2, status='live', current_innings_no=1)
        innings = Innings.objects.create(match=match, innings_no=1, batting_team=self.team1, bowling_team=self.team2)
        BattingScore.objects.create(innings=innings, player=batter1, is_at_crease=True, is_striker=True)
        BattingScore.objects.create(innings=innings, player=batter2, is_at_crease=True, is_striker=False)

        response = self.client.post(
            f'/api/innings/{innings.id}/next-bowler/',
            {'player_id': str(wrong_bowler.id)},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_next_batsman_after_end_of_over_wicket_keeps_existing_batter_on_strike(self):
        self.authenticate(self.scorekeeper_token)
        batter1 = Player.objects.create(name="Rohit", team=self.team1)
        batter2 = Player.objects.create(name="Gill", team=self.team1)
        new_batter = Player.objects.create(name="Sky", team=self.team1)
        bowler = Player.objects.create(name="Starc", team=self.team2)

        match = Match.objects.create(
            team1=self.team1,
            team2=self.team2,
            overs=20,
            players_per_team=3,
            status='live',
            current_innings_no=1,
        )
        innings = Innings.objects.create(match=match, innings_no=1, batting_team=self.team1, bowling_team=self.team2)
        striker_score = BattingScore.objects.create(innings=innings, player=batter1, is_at_crease=True, is_striker=True)
        non_striker_score = BattingScore.objects.create(innings=innings, player=batter2, is_at_crease=True, is_striker=False)
        BowlingScore.objects.create(innings=innings, player=bowler, is_current=True)
        innings.total_balls = 5
        innings.save(update_fields=['total_balls'])

        record_ball(innings.id, {
            'striker_id': str(batter1.id),
            'non_striker_id': str(batter2.id),
            'bowler_id': str(bowler.id),
            'runs_scored': 0,
            'extras_type': None,
            'extras_runs': 0,
            'is_wicket': True,
            'wicket_type': 'bowled',
        })

        response = self.client.post(
            f'/api/innings/{innings.id}/next-batsman/',
            {'player_id': str(new_batter.id)},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        striker_score.refresh_from_db()
        non_striker_score.refresh_from_db()
        new_batter_score = BattingScore.objects.get(innings=innings, player=new_batter)

        self.assertFalse(striker_score.is_at_crease)
        self.assertTrue(non_striker_score.is_at_crease)
        self.assertTrue(non_striker_score.is_striker)
        self.assertTrue(new_batter_score.is_at_crease)
        self.assertFalse(new_batter_score.is_striker)

    def test_user_can_request_scorekeeper_role(self):
        self.authenticate(self.user_token)
        response = self.client.post('/api/scorekeeper-requests/', {
            'message': 'I can help score weekend matches.'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ScorekeeperRequest.objects.filter(user=self.user).count(), 1)

    def test_manager_can_approve_scorekeeper_request(self):
        request_record = ScorekeeperRequest.objects.create(user=self.user, message='Ready to help')
        self.authenticate(self.manager_token)

        response = self.client.post(f'/api/scorekeeper-requests/{request_record.id}/approve/', {
            'review_note': 'Approved for live scoring.'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        request_record.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(request_record.status, ScorekeeperRequest.STATUS_APPROVED)
        self.assertEqual(self.user.profile.user_type, UserProfile.SCOREKEEPER)

    def test_manager_cannot_record_ball_without_scorekeeper_role(self):
        self.authenticate(self.manager_token)
        batter1 = Player.objects.create(name="Rohit", team=self.team1)
        batter2 = Player.objects.create(name="Gill", team=self.team1)
        bowler = Player.objects.create(name="Starc", team=self.team2)
        match = Match.objects.create(team1=self.team1, team2=self.team2, overs=20, players_per_team=2, status='live', current_innings_no=1)
        innings = Innings.objects.create(match=match, innings_no=1, batting_team=self.team1, bowling_team=self.team2)
        BattingScore.objects.create(innings=innings, player=batter1, is_at_crease=True, is_striker=True)
        BattingScore.objects.create(innings=innings, player=batter2, is_at_crease=True, is_striker=False)
        BowlingScore.objects.create(innings=innings, player=bowler, is_current=True)

        response = self.client.post(f'/api/innings/{innings.id}/ball/', {
            'striker_id': str(batter1.id),
            'non_striker_id': str(batter2.id),
            'bowler_id': str(bowler.id),
            'runs_scored': 1,
            'extras_type': None,
            'extras_runs': 0,
            'is_wicket': False,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
