from django.db import transaction
from .models import BallEvent, BattingScore, BowlingScore, Innings


def should_credit_bowler_for_wicket(wicket_type):
    return wicket_type not in ['run_out', 'retired_hurt', 'timed_out']


def sync_tournament_status(match):
    tournament = match.tournament
    if not tournament:
        return

    statuses = list(tournament.matches.values_list('status', flat=True))
    if statuses and all(status == 'completed' for status in statuses):
        tournament.status = 'completed'
    elif any(status in {'live', 'innings_break'} for status in statuses):
        tournament.status = 'live'
    else:
        tournament.status = 'setup'
    tournament.save(update_fields=['status'])

def record_ball(innings_id, data):
    """
    Records a ball and updates all related stats atomically.
    data = {
        'striker_id': ...,
        'non_striker_id': ...,
        'bowler_id': ...,
        'runs_scored': ...,
        'extras_type': ...,
        'extras_runs': ...,
        'is_wicket': ...,
        'wicket_type': ...,
    }
    """
    with transaction.atomic():
        innings = Innings.objects.select_for_update().get(id=innings_id)
        match = innings.match
        if innings.is_completed or match.status == 'completed':
            raise ValueError('This innings is already complete.')
        
        striker_score = BattingScore.objects.get(innings=innings, player_id=data['striker_id'])
        non_striker_score = BattingScore.objects.get(innings=innings, player_id=data['non_striker_id'])
        bowler_score = BowlingScore.objects.get(innings=innings, player_id=data['bowler_id'])
        
        is_legal = data.get('extras_type') not in ['wd', 'nb']
        
        # 1. Create BallEvent
        ball_no = innings.total_balls + (1 if is_legal else 0)
        over_no = innings.total_balls // 6
        
        ball = BallEvent.objects.create(
            innings=innings,
            ball_no=ball_no,
            over_no=over_no,
            striker_id=data['striker_id'],
            non_striker_id=data['non_striker_id'],
            bowler_id=data['bowler_id'],
            runs_scored=data['runs_scored'],
            extras_runs=data.get('extras_runs', 0),
            extras_type=data.get('extras_type'),
            is_wicket=data.get('is_wicket', False),
            wicket_type=data.get('wicket_type'),
        )
        
        # 2. Update Innings
        total_ball_runs = data['runs_scored'] + data.get('extras_runs', 0)
        innings.total_runs += total_ball_runs
        if is_legal:
            innings.total_balls += 1
        if data.get('extras_type'):
            innings.total_extras += data.get('extras_runs', 0)
        
        if data.get('is_wicket'):
            innings.total_wickets += 1
            striker_score.is_out = True
            striker_score.is_at_crease = False
            striker_score.is_striker = False
            striker_score.wicket_type = data.get('wicket_type')
            striker_score.dismissed_by_id = (
                data['bowler_id'] if should_credit_bowler_for_wicket(data.get('wicket_type')) else None
            )
            
            # LMS: If this was the second to last wicket, the non-striker becomes the last man (striker)
            total_players = innings.batting_team.players.count()
            if match.last_man_stands and innings.total_wickets == total_players - 1:
                non_striker_score.is_striker = True
                non_striker_score.save()
        
        innings.save()
        
        # 3. Update BattingScore
        if data.get('extras_type') not in ['lb', 'b', 'wd', 'penalty']: # Runs off bat only
            striker_score.runs += data['runs_scored']
            if data['runs_scored'] == 4: striker_score.fours += 1
            if data['runs_scored'] == 6: striker_score.sixes += 1
            
        striker_score.balls_faced += 1 if data.get('extras_type') != 'wd' else 0
        striker_score.save()
        
        # 4. Update BowlingScore
        if is_legal:
            bowler_score.balls_bowled += 1
            
        # Runs conceded by bowler: Bat runs + Wides + No-balls
        bowler_runs = data['runs_scored']
        if data.get('extras_type') in ['wd', 'nb']:
            bowler_runs += data.get('extras_runs', 0)
        elif data.get('extras_type') in ['lb', 'b']:
            bowler_runs = 0 # Byes/Leg-byes don't go to bowler
            
        bowler_score.runs_conceded += bowler_runs
        
        if data.get('is_wicket') and should_credit_bowler_for_wicket(data.get('wicket_type')):
            bowler_score.wickets += 1
        bowler_score.save()
        
        # 5. Strike Rotation
        should_rotate = False
        if not data.get('is_wicket'):
            # Physical runs taken:
            # - Normal/NB: runs_scored
            # - LB/B: extras_runs
            # - WD: extras_runs - 1
            physical_runs = 0
            if not data.get('extras_type') or data.get('extras_type') == 'nb':
                physical_runs = data.get('runs_scored', 0)
            elif data.get('extras_type') in ['lb', 'b']:
                physical_runs = data.get('extras_runs', 0)
            elif data.get('extras_type') == 'wd':
                physical_runs = max(0, data.get('extras_runs', 0) - 1)
                
            if physical_runs % 2 != 0:
                should_rotate = True
            
            # End of over rotation
            if is_legal and innings.total_balls % 6 == 0:
                should_rotate = not should_rotate
                
            if should_rotate:
                # Check LMS rule: No rotation if last man is standing
                total_players = innings.batting_team.players.count()
                is_lms_active = match.last_man_stands and innings.total_wickets == total_players - 1
                
                if not is_lms_active:
                    striker_score.is_striker = False
                    non_striker_score.is_striker = True
                    striker_score.save()
                    non_striker_score.save()

        # 6. Check Match Conclusion
        check_match_conclusion(innings)
        
        return ball

def undo_ball(innings_id):
    with transaction.atomic():
        innings = Innings.objects.select_for_update().get(id=innings_id)
        last_ball = BallEvent.objects.filter(innings=innings).last()
        
        if not last_ball:
            return None
        
        # Revert stats
        is_legal = last_ball.extras_type not in ['wd', 'nb']
        total_ball_runs = last_ball.runs_scored + last_ball.extras_runs
        
        innings.total_runs -= total_ball_runs
        if is_legal:
            innings.total_balls -= 1
        if last_ball.extras_type:
            innings.total_extras -= last_ball.extras_runs
        
        # 2. Restore crease state
        # First, remove everyone from the crease
        BattingScore.objects.filter(innings=innings).update(is_at_crease=False, is_striker=False)
        
        # Restore striker
        striker_score = BattingScore.objects.get(innings=innings, player=last_ball.striker)
        striker_score.is_at_crease = True
        striker_score.is_striker = True
        if last_ball.is_wicket:
            innings.total_wickets -= 1
            striker_score.is_out = False
            striker_score.wicket_type = None
            striker_score.dismissed_by = None
        striker_score.save()
        
        # Restore non-striker (only if different from striker, e.g. not LMS placeholder)
        if last_ball.non_striker != last_ball.striker:
            non_striker_score = BattingScore.objects.get(innings=innings, player=last_ball.non_striker)
            non_striker_score.is_at_crease = True
            non_striker_score.is_striker = False
            non_striker_score.save()
            
        # Clean up: If anyone else has a BattingScore record with 0 stats, they were likely a 
        # replacement for a wicket that was just undone. We should delete their record
        # so they reappear in the "available" list.
        BattingScore.objects.filter(
            innings=innings,
            is_at_crease=False,
            runs=0,
            balls_faced=0,
            is_out=False
        ).delete()
            
        innings.save()
        
        # Revert Batting
        striker_score = BattingScore.objects.get(innings=innings, player=last_ball.striker)
        if last_ball.extras_type not in ['lb', 'b', 'penalty']:
            striker_score.runs -= last_ball.runs_scored
            if last_ball.runs_scored == 4: striker_score.fours -= 1
            if last_ball.runs_scored == 6: striker_score.sixes -= 1
        striker_score.balls_faced -= 1 if last_ball.extras_type != 'wd' else 0
        striker_score.save()
        
        # Revert Bowling
        BowlingScore.objects.filter(innings=innings).update(is_current=False)
        bowler_score = BowlingScore.objects.get(innings=innings, player=last_ball.bowler)
        bowler_score.is_current = True
        if is_legal:
            bowler_score.balls_bowled -= 1
            
        bowler_runs = last_ball.runs_scored
        if last_ball.extras_type in ['wd', 'nb']:
            bowler_runs += last_ball.extras_runs
        elif last_ball.extras_type in ['lb', 'b']:
            bowler_runs = 0
            
        bowler_score.runs_conceded -= bowler_runs
        if last_ball.is_wicket and last_ball.wicket_type not in ['run_out', 'retired_hurt', 'timed_out']:
            bowler_score.wickets -= 1
        bowler_score.save()
        
        # Restore Match status if it was completed
        match = innings.match
        innings.is_completed = False
        if match.status == 'completed':
            match.status = 'live'
            match.winner = None
            match.save()
        elif match.status == 'innings_break':
            match.status = 'live'
            match.save()
        innings.save(update_fields=['total_runs', 'total_balls', 'total_extras', 'total_wickets', 'is_completed'])
        sync_tournament_status(match)
            
        last_ball.delete()
        return True

def check_match_conclusion(innings):
    match = innings.match
    overs_limit = match.overs
    
    # Use actual team player count for wickets limit
    total_batting_players = innings.batting_team.players.count()
    wickets_limit = total_batting_players - (0 if match.last_man_stands else 1)
    
    innings_over = False
    if innings.total_balls >= overs_limit * 6:
        innings_over = True
    if innings.total_wickets >= wickets_limit:
        innings_over = True
        
    # Second innings target check
    if innings.innings_no == 2 and innings.target is not None:
        if innings.total_runs >= innings.target:
            innings_over = True
            match.status = 'completed'
            match.winner = innings.batting_team
            match.save()
            innings.is_completed = True
            innings.save()
            sync_tournament_status(match)
            return

    if innings_over:
        innings.is_completed = True
        innings.save(update_fields=['is_completed'])
        if innings.innings_no == 1:
            match.status = 'innings_break'
            match.save()
        else:
            match.status = 'completed'
            # Determine winner
            first_innings = match.innings.get(innings_no=1)
            if innings.total_runs > first_innings.total_runs:
                match.winner = innings.batting_team
            elif innings.total_runs < first_innings.total_runs:
                # The team that didn't bat in the 2nd innings is the winner
                match.winner = match.team1 if innings.batting_team == match.team2 else match.team2
            else:
                # Tie - winner remains None
                match.winner = None 
            match.save()
            sync_tournament_status(match)
