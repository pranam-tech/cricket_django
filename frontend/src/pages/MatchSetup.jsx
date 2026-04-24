import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchApi } from '../api';
import { Settings, Users, Clock, Play, Plus, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MatchSetup = () => {
  const [formData, setFormData] = useState({
    team1_name: 'Warriors',
    team2_name: 'Titans',
    overs: 20,
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
    if (team1Players.length < 2 || team2Players.length < 2) {
      alert("Each team must have at least 2 players.");
      return;
    }

    setLoading(true);
    try {
      const res = await matchApi.create({
        ...formData,
        team1_players: team1Players,
        team2_players: team2Players,
      });
      navigate(`/scoring/${res.data.id}`);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
      >
        <div className="flex items-center gap-3 mb-10">
          <div className="p-3 primary-gradient rounded-xl shadow-lg shadow-primary/20">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black">Match Setup</h2>
            <p className="text-secondary text-sm">Configure teams and players</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* General Config */}
          <div className="grid sm:grid-cols-2 gap-8 p-6 bg-white/5 rounded-2xl border border-white/5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] flex items-center gap-2">
                <Clock className="w-3 h-3" /> Match Overs
              </label>
              <input
                type="number"
                value={formData.overs}
                onChange={e => setFormData({ ...formData, overs: parseInt(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                min="1"
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Last Man Standing</label>
                <p className="text-[10px] text-secondary/60">Final batsman can play alone</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, last_man_stands: !formData.last_man_stands })}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  formData.last_man_stands ? "bg-primary" : "bg-white/10"
                )}
              >
                <motion.div
                  animate={{ x: formData.last_man_stands ? 24 : 4 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md"
                />
              </button>
            </div>
          </div>

          {/* Teams Grid */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Team 1 */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Home Team Name</label>
                <input
                  type="text"
                  value={formData.team1_name}
                  onChange={e => setFormData({ ...formData, team1_name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-4 h-4" /> Players ({team1Players.length})
                </p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <AnimatePresence>
                    {team1Players.map((player, idx) => (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        key={idx}
                        className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 group"
                      >
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4 text-secondary/40" />
                          <span className="font-medium">{player}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePlayer(1, idx)}
                          className="text-secondary/40 hover:text-accent p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPlayer1}
                    onChange={e => setNewPlayer1(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addPlayer(1))}
                    placeholder="Player name..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => addPlayer(1)}
                    className="glass-button p-2 primary-gradient border-none"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Team 2 */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">Away Team Name</label>
                <input
                  type="text"
                  value={formData.team2_name}
                  onChange={e => setFormData({ ...formData, team2_name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-accent/50"
                  required
                />
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-4 h-4" /> Players ({team2Players.length})
                </p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <AnimatePresence>
                    {team2Players.map((player, idx) => (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        key={idx}
                        className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 group"
                      >
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4 text-secondary/40" />
                          <span className="font-medium">{player}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePlayer(2, idx)}
                          className="text-secondary/40 hover:text-accent p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPlayer2}
                    onChange={e => setNewPlayer2(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addPlayer(2))}
                    placeholder="Player name..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => addPlayer(2)}
                    className="glass-button p-2 accent-gradient border-none"
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
            className="w-full py-5 primary-gradient rounded-2xl font-black text-xl flex items-center justify-center gap-3 mt-8 shadow-xl shadow-primary/20"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
