import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { matchApi } from '../api';
import { Trophy, ArrowLeft, Download, Share2, User, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Summary = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    matchApi.get(matchId)
      .then(res => {
        setMatch(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [matchId]);

  if (loading) return <div className="flex items-center justify-center h-screen bg-background"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!match) return <div className="p-10 text-center">Match not found</div>;

  const currentInn = match.innings && match.innings[activeTab];

  return (
    <div className="max-w-4xl mx-auto p-6 py-10 min-h-screen bg-background">
      <header className="flex justify-between items-center mb-10">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-secondary hover:text-foreground transition-colors font-black uppercase text-[10px] tracking-widest">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>
        <div className="flex gap-3">
          <button className="p-2 glass rounded-lg text-secondary hover:text-foreground"><Share2 className="w-4 h-4" /></button>
          <button className="p-2 glass rounded-lg text-secondary hover:text-foreground"><Download className="w-4 h-4" /></button>
        </div>
      </header>

      {/* Result Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card mb-10 p-10 relative overflow-hidden border-b-4 border-primary shadow-2xl"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Trophy className="w-32 h-32 text-primary" />
        </div>
        
        <div className="text-center mb-8">
          <p className="text-primary font-black uppercase tracking-[0.4em] text-[10px] mb-4">MATCH RESULT</p>
          <h1 className="text-4xl font-black mb-2 uppercase italic tracking-tight">
            {match.winner ? `${match.winner_name} WON` : 'MATCH DRAWN'}
          </h1>
          <div className="h-1 w-20 primary-gradient mx-auto rounded-full mb-4" />
          <p className="text-[10px] text-secondary font-black uppercase tracking-widest tabular-nums">
            {new Date(match.created_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })} • {new Date(match.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 items-center">
          <div className="text-center">
            <h3 className="text-xl font-black mb-1">{match.team1_name}</h3>
            <p className="text-4xl font-black tabular-nums">{match.team1_score}</p>
            <p className="text-[10px] text-secondary font-black uppercase tracking-widest mt-1">{match.overs} OVERS</p>
          </div>
          <div className="text-center text-secondary font-black text-2xl italic">VS</div>
          <div className="text-center">
            <h3 className="text-xl font-black mb-1">{match.team2_name}</h3>
            <p className="text-4xl font-black tabular-nums">{match.team2_score}</p>
            <p className="text-[10px] text-secondary font-black uppercase tracking-widest mt-1">{match.overs} OVERS</p>
          </div>
        </div>
      </motion.div>

      {/* Scorecard Tabs */}
      {match.innings && match.innings.length > 0 && (
        <div className="flex gap-4 mb-8">
          {match.innings.map((inn, idx) => (
            <button 
              key={inn.id}
              onClick={() => setActiveTab(idx)}
              className={`flex-1 py-4 px-6 rounded-2xl font-black uppercase text-xs tracking-widest transition-all ${activeTab === idx ? 'primary-gradient shadow-lg shadow-primary/20' : 'glass text-secondary hover:text-foreground'}`}
            >
              {inn.batting_team_name} Innings
            </button>
          ))}
        </div>
      )}

      {/* Scorecard Content */}
      <AnimatePresence mode="wait">
        {currentInn ? (
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-10"
          >
            {/* Timeline in Summary */}
            <section>
              <h4 className="text-sm font-black uppercase tracking-widest text-secondary mb-6">Innings Timeline</h4>
              <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8 px-1">
                {currentInn.balls && currentInn.balls.map((ball, idx, arr) => (
                  <React.Fragment key={ball.id}>
                    {(idx === 0 || ball.over_no !== arr[idx-1].over_no) && (
                      <div className="flex gap-4 items-end">
                        {idx > 0 && (
                          <div className="w-[2px] h-24 bg-white/5 self-center rounded-full mx-2" />
                        )}
                        <div className="flex flex-col gap-3 min-w-max">
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">Over {ball.over_no + 1} • {ball.bowler_name}</p>
                          <div className="flex gap-2">
                            {arr.filter(b => b.over_no === ball.over_no).map(b => (
                              <div
                                key={b.id}
                                className={cn(
                                  "min-w-[2.5rem] h-10 flex items-center justify-center text-[10px] font-black rounded-xl border transition-all shadow-sm",
                                  b.is_wicket ? "bg-accent/20 border-accent/40 text-accent shadow-accent/10" : 
                                  b.runs_scored >= 4 ? "bg-primary/20 border-primary/40 text-primary shadow-primary/10" : "bg-white/5 border-white/10 text-secondary"
                                )}
                              >
                                {b.is_wicket ? 'W' : (b.extras_type ? `${b.extras_runs}${b.extras_type.toUpperCase()}` : b.runs_scored)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </section>

            {/* Batting Scorecard */}
            <section>
              <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-secondary mb-6">
                <User className="w-4 h-4 text-primary" /> Batting Scorecard
              </h4>
              <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black uppercase text-secondary">
                      <th className="px-6 py-4">Batsman</th>
                      <th className="px-6 py-4 text-center">R</th>
                      <th className="px-6 py-4 text-center">B</th>
                      <th className="px-6 py-4 text-center">4s</th>
                      <th className="px-6 py-4 text-center">6s</th>
                      <th className="px-6 py-4 text-right">SR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {currentInn.batting_scores && currentInn.batting_scores.map(bs => (
                      <tr key={bs.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-black text-sm">{bs.player_name}</p>
                          <p className="text-[10px] text-secondary font-bold italic">{bs.is_out ? `out (${bs.wicket_type})` : 'not out'}</p>
                        </td>
                        <td className="px-6 py-4 text-center font-black tabular-nums">{bs.runs}</td>
                        <td className="px-6 py-4 text-center text-secondary tabular-nums">{bs.balls_faced}</td>
                        <td className="px-6 py-4 text-center text-secondary tabular-nums">{bs.fours}</td>
                        <td className="px-6 py-4 text-center text-secondary tabular-nums">{bs.sixes}</td>
                        <td className="px-6 py-4 text-right font-black tabular-nums text-primary">
                          {(bs.runs / (bs.balls_faced || 1) * 100).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Bowling Figures */}
            <section>
              <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-secondary mb-6">
                <Target className="w-4 h-4 text-accent" /> Bowling Figures
              </h4>
              <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black uppercase text-secondary">
                      <th className="px-6 py-4">Bowler</th>
                      <th className="px-6 py-4 text-center">O</th>
                      <th className="px-6 py-4 text-center">M</th>
                      <th className="px-6 py-4 text-center">R</th>
                      <th className="px-6 py-4 text-center">W</th>
                      <th className="px-6 py-4 text-right">ECON</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {currentInn.bowling_scores && currentInn.bowling_scores.map(bs => (
                      <tr key={bs.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-black text-sm">{bs.player_name}</td>
                        <td className="px-6 py-4 text-center tabular-nums">
                          {Math.floor(bs.balls_bowled / 6)}.{bs.balls_bowled % 6}
                        </td>
                        <td className="px-6 py-4 text-center text-secondary tabular-nums">{bs.maidens}</td>
                        <td className="px-6 py-4 text-center font-black tabular-nums">{bs.runs_conceded}</td>
                        <td className="px-6 py-4 text-center font-black text-accent tabular-nums">{bs.wickets}</td>
                        <td className="px-6 py-4 text-right font-black tabular-nums text-accent">
                          {(bs.runs_conceded / (bs.balls_bowled / 6 || 1)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </motion.div>
        ) : (
          <div className="glass-card p-12 text-center text-secondary uppercase font-black tracking-widest opacity-30">
            No scorecard data recorded
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Summary;
