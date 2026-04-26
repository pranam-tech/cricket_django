import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchApi } from '../api';
import { Settings, Users, Clock, Play, Plus, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MatchSetup = () => {
  const [formData, setFormData] = useState({
    team1_name: 'Warriors',
    team2_name: 'Titans',
    overs: 3,
    last_man_stands: true,
  });

  const [team1Players, setTeam1Players] = useState(['Player 1', 'Player 2', 'Player 3']);
  const [team2Players, setTeam2Players] = useState(['Player 1', 'Player 2', 'Player 3']);

  const [newPlayer1, setNewPlayer1] = useState('');
  const [newPlayer2, setNewPlayer2] = useState('');

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const addPlayer = (teamNo) => {
    if (teamNo === 1 && newPlayer1.trim()) {
      setTeam1Players([...team1Players, newPlayer1.trim()]);
      setNewPlayer1('');
    } else if (teamNo === 2 && newPlayer2.trim()) {
      setTeam2Players([...team2Players, newPlayer2.trim()]);
      setNewPlayer2('');
    }
  };

  const removePlayer = (teamNo, index) => {
    if (teamNo === 1) {
      setTeam1Players(team1Players.filter((_, i) => i !== index));
    } else {
      setTeam2Players(team2Players.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const t1 = formData.team1_name.trim();
    const t2 = formData.team2_name.trim();

    if (!t1 || !t2) {
      alert("Team names cannot be empty.");
      return;
    }
    if (t1 === t2) {
      alert("Team names must be different.");
      return;
    }
    if (formData.overs <= 0) {
      alert("Match must have at least 1 over.");
      return;
    }
    if (team1Players.length < 2 || team2Players.length < 2) {
      alert("Each team must have at least 2 players.");
      return;
    }

    setLoading(true);
    try {
      const res = await matchApi.create({
        ...formData,
        team1_name: t1,
        team2_name: t2,
        team1_players: team1Players,
        team2_players: team2Players,
      });
      navigate(`/scoring/${res.data.id}`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to create match. Please check all fields.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 py-4 sm:p-6 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
      >
        <div className="flex items-start gap-3 mb-6 sm:mb-10">
          <div className="p-2.5 sm:p-3 primary-gradient rounded-xl shadow-lg shadow-primary/20 shrink-0">
            <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-black break-words">Match Setup</h2>
            <p className="text-secondary text-xs sm:text-sm break-words">Configure teams and players</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-10">
          {/* General Config */}
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-8 p-4 sm:p-6 bg-foreground/5 rounded-2xl border border-foreground/5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] flex flex-wrap items-center gap-2">
                <Clock className="w-3 h-3" /> Match Overs
              </label>
              <input
                type="number"
                value={formData.overs || ''}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  setFormData({ ...formData, overs: isNaN(val) ? 0 : val });
                }}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 sm:px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold text-base"
                min="1"
                required
              />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <label className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] break-words">Last Man Standing</label>
                <p className="text-[10px] text-secondary/60 break-words">Final batsman can play alone</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, last_man_stands: !formData.last_man_stands })}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative shrink-0 mt-0.5",
                  formData.last_man_stands ? "bg-primary" : "bg-foreground/10"
                )}
              >
                <motion.div
                  animate={{ x: formData.last_man_stands ? 24 : 4 }}
                  className="absolute top-1 w-4 h-4 bg-foreground rounded-full shadow-md"
                />
              </button>
            </div>
          </div>

          {/* Teams Grid */}
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
            {/* Team 1 */}
            <div className="space-y-5 sm:space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Home Team Name</label>
                <input
                  type="text"
                  value={formData.team1_name}
                  onChange={e => setFormData({ ...formData, team1_name: e.target.value })}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 sm:px-4 py-3 sm:py-4 text-lg sm:text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div className="space-y-4">
                <p className="text-[11px] sm:text-xs font-bold text-secondary uppercase tracking-[0.18em] sm:tracking-widest flex flex-wrap items-center gap-2">
                  <Users className="w-4 h-4" /> Players ({team1Players.length})
                </p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                  <AnimatePresence>
                    {team1Players.map((player, idx) => (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        key={idx}
                        className="flex items-center justify-between gap-2 bg-foreground/5 p-3 rounded-xl border border-foreground/5 group"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <User className="w-4 h-4 text-secondary/40 shrink-0" />
                          <span className="font-medium text-sm sm:text-base break-words leading-snug">{player}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePlayer(1, idx)}
                          className="text-secondary/40 hover:text-accent p-1 shrink-0 self-start"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="flex gap-2 items-stretch">
                  <input
                    type="text"
                    value={newPlayer1}
                    onChange={e => setNewPlayer1(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPlayer(1))}
                    placeholder="Player name..."
                    className="flex-1 min-w-0 bg-foreground/5 border border-foreground/10 rounded-xl px-3 sm:px-4 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => addPlayer(1)}
                    className="glass-button h-auto min-w-[44px] px-3 sm:px-4 py-2 primary-gradient border-none shrink-0"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Team 2 */}
            <div className="space-y-5 sm:space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">Away Team Name</label>
                <input
                  type="text"
                  value={formData.team2_name}
                  onChange={e => setFormData({ ...formData, team2_name: e.target.value })}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 sm:px-4 py-3 sm:py-4 text-lg sm:text-xl font-bold focus:outline-none focus:ring-2 focus:ring-accent/50"
                  required
                />
              </div>

              <div className="space-y-4">
                <p className="text-[11px] sm:text-xs font-bold text-secondary uppercase tracking-[0.18em] sm:tracking-widest flex flex-wrap items-center gap-2">
                  <Users className="w-4 h-4" /> Players ({team2Players.length})
                </p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                  <AnimatePresence>
                    {team2Players.map((player, idx) => (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        key={idx}
                        className="flex items-center justify-between gap-2 bg-foreground/5 p-3 rounded-xl border border-foreground/5 group"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <User className="w-4 h-4 text-secondary/40 shrink-0" />
                          <span className="font-medium text-sm sm:text-base break-words leading-snug">{player}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePlayer(2, idx)}
                          className="text-secondary/40 hover:text-accent p-1 shrink-0 self-start"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="flex gap-2 items-stretch">
                  <input
                    type="text"
                    value={newPlayer2}
                    onChange={e => setNewPlayer2(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPlayer(2))}
                    placeholder="Player name..."
                    className="flex-1 min-w-0 bg-foreground/5 border border-foreground/10 rounded-xl px-3 sm:px-4 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => addPlayer(2)}
                    className="glass-button h-auto min-w-[44px] px-3 sm:px-4 py-2 accent-gradient border-none shrink-0"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            className="w-full py-4 sm:py-5 primary-gradient rounded-2xl font-black text-base sm:text-xl flex items-center justify-center gap-2 sm:gap-3 mt-6 sm:mt-8 shadow-xl shadow-primary/20"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-6 h-6 fill-current" />
                START MATCH
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

// Helper for conditional classes
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default MatchSetup;
