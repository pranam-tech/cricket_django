import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { matchApi, inningsApi } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { Undo2, Trophy, RotateCw, AlertCircle, X, UserPlus, ShieldAlert, Home, User, Play } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Scoring = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Scoring state
  const [extraMode, setExtraMode] = useState(null);
  const [activeView, setActiveView] = useState('scoring');
  const [isWicketPending, setIsWicketPending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isManualBowlerChange, setIsManualBowlerChange] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await matchApi.getLive(matchId);
      setMatch(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Failed to load match state");
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleStartInnings = async (inningsNo, teamId) => {
    setIsProcessing(true);
    try {
      await matchApi.startInnings(matchId, { innings_no: inningsNo, batting_team_id: teamId });
      await fetchState();
    } catch (err) {
      alert("Failed to start innings");
    } finally {
      setIsProcessing(false);
    }
  };

  // ... (rest of the functions remain same, but I'll make sure they are not duplicated)

  const handleBall = async (runs, extrasType = null, isWicket = false, wicketType = 'out') => {
    if (!striker || (!nonStriker && !isLMSActive) || !currentBowler || isProcessing) return;

    // --- OPTIMISTIC UPDATE START ---
    // We update the UI immediately before the network request finishes
    const prevMatch = { ...match };
    const newMatch = JSON.parse(JSON.stringify(match)); // Deep copy
    const inn = newMatch.current_innings_data;

    // 1. Update Runs & Balls
    let extrasRuns = 0;
    let batterRuns = 0;

    if (!extrasType) {
      batterRuns = runs;
    } else if (extrasType === 'nb') {
      extrasRuns = 1;
      batterRuns = runs;
    } else if (extrasType === 'wd') {
      extrasRuns = 1 + runs;
      batterRuns = 0;
    } else if (extrasType === 'b' || extrasType === 'lb') {
      extrasRuns = runs;
      batterRuns = 0;
    }

    inn.total_runs += (batterRuns + extrasRuns);
    if (isWicket) inn.total_wickets += 1;
    if (!['wd', 'nb'].includes(extrasType)) inn.total_balls += 1;

    // 2. Add fake ball to timeline for instant feedback
    const fakeBall = {
      id: 'temp-' + Date.now(),
      runs_scored: batterRuns,
      extras_type: extrasType,
      extras_runs: extrasRuns,
      is_wicket: isWicket,
      over_no: Math.floor((inn.total_balls || 0) / 6),
      bowler_name: currentBowler?.player_name,
      striker: striker?.player,
      non_striker: nonStriker?.player,
      bowler: currentBowler?.player
    };
    inn.balls.push(fakeBall);

    // 3. Update player scores & Strike Rotation
    const s = inn.batting_scores.find(b => b.player === striker.player);
    const ns = inn.batting_scores.find(b => b.player === nonStriker?.player);

    if (s) {
      s.runs += batterRuns;
      if (!['wd', 'nb'].includes(extrasType)) {
        s.balls_faced += 1;
      }
    }

    // Determine physical runs for rotation (runs actually taken)
    let physicalRuns = (extrasType === 'wd' || extrasType === 'b' || extrasType === 'lb') ? runs : batterRuns;

    let rotate = physicalRuns % 2 !== 0;
    if (!['wd', 'nb'].includes(extrasType) && inn.total_balls % 6 === 0) {
      rotate = !rotate;
    }

    if (rotate && s && ns && !isLMSActive) {
      s.is_striker = !s.is_striker;
      ns.is_striker = !ns.is_striker;
    }

    setMatch(newMatch);
    // --- OPTIMISTIC UPDATE END ---

    setIsProcessing(true);
    const inningsId = inn.id;
    const data = {
      striker_id: striker.player,
      non_striker_id: nonStriker?.player || striker.player,
      bowler_id: currentBowler.player,
      runs_scored: batterRuns,
      extras_type: extrasType,
      extras_runs: extrasRuns,
      is_wicket: isWicket,
      wicket_type: wicketType
    };

    try {
      await inningsApi.recordBall(inningsId, data);
      setExtraMode(null);
      if (isWicket) {
        setIsWicketPending(true);
      }
      await fetchState(); // Sync with real server state
    } catch (err) {
      console.error(err);
      setMatch(prevMatch); // Rollback on error
      alert("Sync failed. Reverting to last saved state.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectNextBatsman = async (playerId) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await inningsApi.nextBatsman(match.current_innings_data.id, { player_id: playerId });
      setIsWicketPending(false);
      await fetchState();
    } catch (err) {
      alert("Failed to select batsman");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectBowler = async (playerId) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await inningsApi.nextBowler(match.current_innings_data.id, { player_id: playerId });
      setExtraMode(null);
      await fetchState();
    } catch (err) {
      alert("Failed to select bowler");
    } finally {
      setIsProcessing(false);
      setIsManualBowlerChange(false);
    }
  };

  const handleUndo = async () => {
    if (isProcessing || !match?.current_innings_data?.balls?.length) return;

    // --- OPTIMISTIC UPDATE START ---
    const prevMatch = { ...match };
    const newMatch = JSON.parse(JSON.stringify(match));
    const inn = newMatch.current_innings_data;
    const lastBall = inn.balls.pop();

    if (lastBall) {
      inn.total_runs = Math.max(0, (inn.total_runs || 0) - (lastBall.runs_scored + lastBall.extras_runs));
      if (lastBall.is_wicket) inn.total_wickets = Math.max(0, (inn.total_wickets || 0) - 1);

      const wasLegal = !['wd', 'nb'].includes(lastBall.extras_type);
      if (wasLegal) inn.total_balls = Math.max(0, (inn.total_balls || 0) - 1);

      // Revert Player Scores
      const strikerId = lastBall.striker;
      const nonStrikerId = lastBall.non_striker;
      const bowlerId = lastBall.bowler;

      const s = inn.batting_scores.find(b => b.player === strikerId);
      const ns = inn.batting_scores.find(b => b.player === nonStrikerId);
      const b = inn.bowling_scores.find(bo => bo.player === bowlerId);

      // CRITICAL: Only subtract from batter if it wasn't a Wide, Bye, or Leg-Bye
      const isBatRun = !lastBall.extras_type || lastBall.extras_type === 'nb';

      if (s) {
        if (isBatRun) s.runs = Math.max(0, s.runs - lastBall.runs_scored);
        if (wasLegal) s.balls_faced = Math.max(0, s.balls_faced - 1);
        if (lastBall.is_wicket) {
          s.is_out = false;
          s.is_at_crease = true;
        }
      }

      if (b) {
        let bowlerRuns = lastBall.runs_scored;
        if (['wd', 'nb'].includes(lastBall.extras_type)) bowlerRuns += lastBall.extras_runs;
        else if (['lb', 'b'].includes(lastBall.extras_type)) bowlerRuns = 0;

        b.runs_conceded = Math.max(0, b.runs_conceded - bowlerRuns);
        if (wasLegal) b.balls_bowled = Math.max(0, b.balls_bowled - 1);
        if (lastBall.is_wicket) b.wickets = Math.max(0, b.wickets - 1);
      }

      // Revert rotation if needed
      let physicalRuns = 0;
      if (isBatRun) {
        physicalRuns = lastBall.runs_scored;
      } else if (lastBall.extras_type === 'wd') {
        physicalRuns = Math.max(0, lastBall.extras_runs - 1);
      } else if (['b', 'lb'].includes(lastBall.extras_type)) {
        physicalRuns = lastBall.extras_runs;
      }

      let shouldUnrotate = physicalRuns % 2 !== 0;
      if (wasLegal && (inn.total_balls + 1) % 6 === 0) {
        shouldUnrotate = !shouldUnrotate;
      }

      if (shouldUnrotate && s && ns && !match.last_man_stands) {
        s.is_striker = !s.is_striker;
        ns.is_striker = !ns.is_striker;
      }
    }

    setMatch(newMatch);
    // --- OPTIMISTIC UPDATE END ---

    setIsProcessing(true);
    try {
      await inningsApi.undoBall(match.current_innings_data.id);
      setIsWicketPending(false);
      await fetchState();
    } catch (err) {
      console.error(err);
      setMatch(prevMatch);
      alert("Undo failed. Reverting to last saved state.");
    } finally {
      setIsProcessing(false);
    }
  };

  const timelineRef = useRef(null);

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollLeft = timelineRef.current.scrollWidth;
    }
  }, [match?.current_innings_data?.balls?.length]);

  // Automatically clear wicket pending state if we've entered LMS or have no more players
  useEffect(() => {
    if (match && isWicketPending) {
      const currentInnings = match.current_innings_data;
      if (currentInnings) {
        const availableCount = currentInnings.batting_team_players?.filter(p =>
          !currentInnings.batting_scores.some(bs => bs.player === p.id)
        ).length || 0;

        if (availableCount === 0) {
          setIsWicketPending(false);
        }
      }
    }
  }, [isWicketPending, match]);

  if (loading) return <div className="flex items-center justify-center h-screen bg-background"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (error) return <div className="p-10 text-center">{error}</div>;
  if (!match) return <div className="p-10 text-center">Match not found</div>;

  const currentInnings = match.current_innings_data;
  const striker = currentInnings?.batting_scores?.find(b => b.is_striker && b.is_at_crease);
  const nonStriker = currentInnings?.batting_scores?.find(b => !b.is_striker && b.is_at_crease);
  const currentBowler = currentInnings?.bowling_scores?.find(b => b.is_current);

  const availableBatsmen = currentInnings?.batting_team_players?.filter(p =>
    !(currentInnings?.batting_scores || []).some(bs => bs.player === p.id)
  ) || [];

  const overEnded = currentInnings && currentInnings.total_balls > 0 && currentInnings.total_balls % 6 === 0;
  const lastBall = (currentInnings?.balls?.length || 0) > 0 ? currentInnings.balls[currentInnings.balls.length - 1] : null;
  const lastBallWasLegal = lastBall && !(['wd', 'nb'].includes(lastBall.extras_type));

  const isLMSActive = match.last_man_stands && availableBatsmen.length === 0;

  const isBowlerChangeRequired = overEnded && lastBallWasLegal && currentBowler?.player === lastBall?.bowler;
  const isInitialSetupRequired = currentInnings && (
    !striker ||
    (!nonStriker && !isLMSActive) ||
    !currentBowler
  );

  const isWicketPromptRequired = isWicketPending && !isLMSActive && availableBatsmen.length > 0;
  const isMatchCompleted = match.status === 'completed';

  // Identify restricted bowler (who bowled the previous over)
  const currentOverNo = Math.floor((currentInnings?.total_balls || 0) / 6);
  const previousOverBall = currentInnings?.balls?.findLast(b => b.over_no < currentOverNo);
  const restrictedBowlerId = previousOverBall?.bowler;

  return (
    <div className="max-w-xl mx-auto p-2 sm:p-4 min-h-screen flex flex-col bg-background selection:bg-primary/20 relative overflow-y-auto">
      <style>{`
        @media (max-width: 640px) {
          .theme-toggle { display: none !important; }
        }
      `}</style>
      {/* ... (Processing overlay remains) ... */}

      <header className="flex justify-between items-center mb-1 sm:mb-4 shrink-0">
        <button onClick={() => navigate('/')} className="p-2 glass rounded-lg text-secondary hover:text-foreground transition-colors">
          <Home className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-1">
            {match.team1_name} <span className="text-primary/40 italic">vs</span> {match.team2_name}
          </p>
          <div className="flex items-center gap-2 justify-center">
            <span className={cn("w-2 h-2 rounded-full", match.status === 'live' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500")} />
            <span className="text-[10px] uppercase font-black text-foreground tracking-widest">{match.status}</span>
          </div>
        </div>
        <button onClick={handleUndo} className="p-2 glass rounded-lg text-secondary hover:text-foreground transition-colors">
          <Undo2 className="w-5 h-5" />
        </button>
      </header>

      {match.status !== 'completed' && (
        <div className="flex bg-foreground/5 p-1 rounded-2xl mb-1 sm:mb-4 border border-foreground/10 shrink-0">
          <button
            onClick={() => setActiveView('scoring')}
            className={`flex-1 py-2 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeView === 'scoring' ? 'primary-gradient text-white' : 'text-secondary'}`}
          >
            Scoring
          </button>
          <button
            onClick={() => setActiveView('summary')}
            className={`flex-1 py-2 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${activeView === 'summary' ? 'primary-gradient text-white' : 'text-secondary'}`}
          >
            Summary
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {activeView === 'summary' ? (
          <div className="glass-card p-6 text-center">
            <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-black mb-2">Live Match Summary</h3>
            <button onClick={() => navigate(`/summary/${matchId}`)} className="w-full glass-button py-3 primary-gradient border-none font-black">View Full Scorecard →</button>
          </div>
        ) : isMatchCompleted ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card text-center w-full max-w-sm p-10 border-2 border-primary/20 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 primary-gradient" />
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
              <h3 className="text-3xl font-black mb-2 tracking-tight">Match Ended</h3>
              <p className="text-secondary text-sm font-black uppercase tracking-[0.2em] mb-8">
                {match.winner ? `${match.winner_name} won!` : "It's a Tie!"}
              </p>
              <div className="space-y-3">
                <button onClick={() => navigate(`/summary/${matchId}`)} className="w-full glass-button py-4 primary-gradient border-none font-black text-lg shadow-xl shadow-primary/20">View Final Scorecard</button>
                <button onClick={() => navigate('/')} className="w-full glass-button py-3 text-secondary font-black text-sm">Return Home</button>
              </div>
            </motion.div>
          </div>
        ) : (!currentInnings || match.status === 'innings_break') ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card text-center w-full max-w-sm overflow-hidden p-10 border-2 border-primary/20">
              <div className="p-4 bg-primary/10 rounded-2xl w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                <Play className="w-8 h-8 text-primary fill-current" />
              </div>
              {match.status === 'innings_break' ? (
                <>
                  <h3 className="text-2xl font-black mb-2">Innings Break</h3>
                  <p className="text-secondary text-sm mb-10">Target: <span className="text-foreground font-black text-xl">{currentInnings?.total_runs + 1}</span></p>
                  <button onClick={() => handleStartInnings(2, currentInnings.bowling_team)} className="w-full glass-button py-5 primary-gradient border-none font-black text-lg shadow-xl shadow-primary/20">Start 2nd Innings</button>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-black mb-10">Start Match</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <button onClick={() => handleStartInnings(1, match.team1)} className="glass-button py-5 primary-gradient border-none font-black text-lg shadow-xl shadow-primary/20">{match.team1_name} Bats</button>
                    <button onClick={() => handleStartInnings(1, match.team2)} className="glass-button py-5 accent-gradient border-none font-black text-lg shadow-xl shadow-accent/20">{match.team2_name} Bats</button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        ) : (
          <>
            <motion.div layoutId="scorecard" className="glass-card mb-1 sm:mb-2 relative overflow-hidden p-3 sm:p-6 border-b-4 border-primary shadow-2xl shadow-primary/10 shrink-0">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em] mb-1">{currentInnings?.batting_team_name}</p>
                  <div className="flex items-baseline gap-1">
                    <h1 className="text-5xl sm:text-6xl font-black tabular-nums tracking-tighter">{currentInnings?.total_runs || 0}</h1>
                    <span className="text-3xl font-black text-primary/40">/</span>
                    <h2 className="text-3xl sm:text-4xl font-black text-primary tabular-nums">{currentInnings?.total_wickets || 0}</h2>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-secondary/80 font-black uppercase tracking-[0.3em] mb-1">OVERS</p>
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-3xl sm:text-4xl font-black tabular-nums">{Math.floor((currentInnings?.total_balls || 0) / 6)}</span>
                    <span className="text-xl font-black text-secondary">.{(currentInnings?.total_balls || 0) % 6}</span>
                    <span className="text-sm font-black text-secondary/40 ml-1">/ {match.overs}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-t border-foreground/5">
                <div className="flex gap-1.5">
                  {currentInnings?.target && (
                    <div className="px-2.5 py-1 bg-primary/20 rounded-lg border border-primary/20">
                      <p className="text-[9px] font-black text-primary tabular-nums uppercase tracking-tighter">TARGET: {currentInnings.target}</p>
                    </div>
                  )}
                  <div className="px-2.5 py-1 bg-foreground/10 rounded-lg border border-foreground/5">
                    <p className="text-[9px] font-black text-secondary tabular-nums uppercase tracking-tighter">CRR: {((currentInnings?.total_runs || 0) / ((currentInnings?.total_balls || 0) / 6 || 1)).toFixed(2)}</p>
                  </div>
                  {currentInnings?.target && (
                    <div className="px-2.5 py-1 bg-accent/20 rounded-lg border border-accent/20">
                      <p className="text-[9px] font-black text-accent tabular-nums uppercase tracking-tighter">RRR: {Math.max(0, (currentInnings.target - currentInnings.total_runs) / ((match.overs * 6 - currentInnings.total_balls) / 6 || 1)).toFixed(2)}</p>
                    </div>
                  )}
                </div>
                {currentInnings?.target && (
                  <p className="text-[10px] font-black text-foreground/70 uppercase">Need {Math.max(0, currentInnings.target - currentInnings.total_runs)} in {Math.max(0, match.overs * 6 - currentInnings.total_balls)}</p>
                )}
              </div>
            </motion.div>

            {/* Timeline */}
            <div ref={timelineRef} className="mb-0.5 sm:mb-2 flex items-center gap-2 overflow-x-auto pb-1 px-1 shrink-0 scroll-smooth custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {currentInnings?.balls?.slice(-18).map((ball, idx, arr) => {
                  const showSeparator = idx > 0 && ball.over_no !== arr[idx - 1].over_no;
                  return (
                    <React.Fragment key={ball.id}>
                      {showSeparator && (
                        <div className="flex flex-col items-center gap-1 shrink-0 px-1">
                          <div className="w-[1px] h-6 bg-foreground/20" />
                        </div>
                      )}
                      <div className={cn("min-w-[2.5rem] h-10 flex items-center justify-center text-[10px] font-black rounded-xl border shrink-0", ball.is_wicket ? "bg-accent/20 border-accent/40 text-accent" : (ball.runs_scored + ball.extras_runs) >= 4 ? "bg-primary/20 border-primary/40 text-primary" : "bg-foreground/5 border-foreground/10 text-secondary")}>
                        {ball.is_wicket ? 'W' : (ball.extras_type ? `${ball.runs_scored + ball.extras_runs}${ball.extras_type.toUpperCase()}` : ball.runs_scored)}
                      </div>
                    </React.Fragment>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Batsmen */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-0.5 sm:mb-2 shrink-0">
              <div className={cn("glass-card p-2 sm:p-4 border-l-4 transition-all", striker?.is_striker ? "border-primary bg-primary/5" : "border-transparent opacity-60")}>
                <p className="text-[8px] font-black text-secondary uppercase tracking-widest mb-1">Striker</p>
                <div className="flex justify-between items-end">
                  <p className="font-black text-sm truncate flex-1 mr-2">{striker?.player_name || '—'}</p>
                  <p className="text-xl sm:text-2xl font-black shrink-0">{striker?.runs || 0}<span className="text-[10px] text-secondary font-bold ml-1">({striker?.balls_faced || 0})</span></p>
                </div>
              </div>
              <div className={cn("glass-card p-2 sm:p-4 border-l-4 transition-all", !striker?.is_striker && nonStriker?.is_at_crease ? "border-primary bg-primary/5" : "border-transparent opacity-60")}>
                <p className="text-[8px] font-black text-secondary uppercase tracking-widest mb-1">Non-Striker</p>
                <div className="flex justify-between items-end">
                  <p className="font-black text-sm truncate flex-1 mr-2">{nonStriker?.player_name || '—'}</p>
                  <p className="text-xl sm:text-2xl font-black shrink-0">{nonStriker?.runs || 0}<span className="text-[10px] text-secondary font-bold ml-1">({nonStriker?.balls_faced || 0})</span></p>
                </div>
              </div>
            </div>

            {/* Bowler Bar */}
            <div className="glass-card p-1.5 sm:p-3 mb-0.5 sm:mb-2 flex justify-between items-center bg-accent/5 border-l-4 border-accent/40 shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-accent" /></div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[8px] text-secondary font-black uppercase tracking-widest">Bowler</p>
                    <button
                      onClick={() => setIsManualBowlerChange(true)}
                      className="px-1.5 py-0.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded text-[7px] font-black text-accent uppercase tracking-tighter transition-all"
                    >
                      Change
                    </button>
                  </div>
                  <p className="font-black text-sm truncate">{currentBowler?.player_name || '—'}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-xl font-black text-accent">{currentBowler?.wickets || 0}-{currentBowler?.runs_conceded || 0}</p>
                <p className="text-[9px] text-secondary font-black">({Math.floor((currentBowler?.balls_bowled || 0) / 6)}.{(currentBowler?.balls_bowled || 0) % 6})</p>
              </div>
            </div>

            {/* Controls Section */}
            <div className="mt-auto relative pb-1 sm:pb-2 shrink-0">
              <AnimatePresence>
                {(isInitialSetupRequired || isWicketPromptRequired || isBowlerChangeRequired || isManualBowlerChange) && (
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="absolute inset-x-0 bottom-0 z-20 glass-card bg-background/95 backdrop-blur-xl border-primary p-4 sm:p-6 shadow-2xl">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className={cn("text-2xl font-black flex items-center gap-3", (!currentBowler || isBowlerChangeRequired || isManualBowlerChange) ? "text-accent" : "text-primary")}>
                        {(!currentBowler || isBowlerChangeRequired || isManualBowlerChange) ? <RotateCw className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                        {!striker ? "Select Striker" : (!nonStriker && !isLMSActive) ? "Select Non-Striker" : isWicketPromptRequired ? "Next Batsman" : "Select Bowler"}
                      </h4>
                      {(isManualBowlerChange) && (
                        <button onClick={() => setIsManualBowlerChange(false)} className="p-2 hover:bg-foreground/10 rounded-full transition-colors">
                          <X className="w-5 h-5 text-secondary" />
                        </button>
                      )}
                    </div>

                    {!striker ? (
                      <SelectionList items={availableBatsmen} onSelect={handleSelectNextBatsman} />
                    ) : (!nonStriker && !isLMSActive) ? (
                      <SelectionList items={availableBatsmen} onSelect={handleSelectNextBatsman} />
                    ) : (isWicketPending && !isLMSActive) ? (
                      <SelectionList items={availableBatsmen} onSelect={handleSelectNextBatsman} />
                    ) : (isBowlerChangeRequired || isManualBowlerChange || !currentBowler) ? (
                      <SelectionList
                        items={currentInnings.bowling_team_players}
                        onSelect={handleSelectBowler}
                        color="accent"
                        disabledIds={restrictedBowlerId ? [restrictedBowlerId] : []}
                      />
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={cn("space-y-2 sm:space-y-3", (isInitialSetupRequired || isBowlerChangeRequired || isWicketPending) && "opacity-10 pointer-events-none")}>
                {extraMode ? (
                  <div className="glass-card p-4 border-2 border-yellow-500/50 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm font-black text-yellow-500 uppercase tracking-widest">
                        Recording {extraMode === 'wd' ? 'Wide' : extraMode === 'nb' ? 'No Ball' : extraMode === 'b' ? 'Bye' : 'Leg Bye'}
                      </p>
                      <button onClick={() => setExtraMode(null)} className="p-1 hover:bg-foreground/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-secondary" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2, 3, 4, 6].map(runs => (
                        <button key={runs} onClick={() => handleBall(runs, extraMode)} className="glass-button py-4 text-xl font-black border-yellow-500/20 hover:bg-yellow-500/20 text-yellow-500">
                          {runs}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-2 sm:gap-3">
                      {[0, 1, 2, 3, 4, 6].map(runs => (
                        <button key={runs} onClick={() => handleBall(runs)} className="glass-card h-10 sm:h-16 p-0 flex items-center justify-center text-2xl sm:text-3xl font-black hover:bg-primary/10 transition-all">
                          {runs}
                        </button>
                      ))}
                      <button onClick={() => setExtraMode('wd')} className="glass-card h-10 sm:h-16 p-0 flex items-center justify-center text-lg sm:text-xl font-black text-yellow-500">WD</button>
                      <button onClick={() => setExtraMode('nb')} className="glass-card h-10 sm:h-16 p-0 flex items-center justify-center text-lg sm:text-xl font-black text-yellow-500">NB</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <button onClick={() => setExtraMode('b')} className="glass-card h-8 sm:h-14 p-0 flex items-center justify-center text-[10px] sm:text-xs font-black text-secondary uppercase">Bye</button>
                      <button onClick={() => setExtraMode('lb')} className="glass-card h-8 sm:h-14 p-0 flex items-center justify-center text-[10px] sm:text-xs font-black text-secondary uppercase">Leg-Bye</button>
                      <button onClick={() => handleBall(0, null, true)} className="glass-card h-8 sm:h-14 p-0 flex items-center justify-center accent-gradient border-none text-red-500 text-sm sm:text-lg font-black uppercase shadow-lg shadow-accent/20">Wicket</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const SelectionList = ({ items, onSelect, color = "primary", disabledIds = [] }) => (
  <div className="grid grid-cols-2 gap-2 sm:gap-4 max-h-[180px] sm:max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
    {items.length > 0 ? items.map(p => (
      <button key={p.id} disabled={disabledIds.includes(p.id)} onClick={() => onSelect(p.id)}
        className={cn("glass-button py-4 text-sm font-black border-foreground/10 transition-all", disabledIds.includes(p.id) ? "opacity-20 grayscale cursor-not-allowed" : color === "primary" ? "hover:bg-primary/20" : "hover:bg-accent/20")}
      >{p.name}</button>
    )) : (
      <p className="col-span-2 text-center py-10 text-secondary font-black uppercase tracking-widest text-xs opacity-50">No players available</p>
    )}
  </div>
);

export default Scoring;
