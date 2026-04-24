import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { matchApi } from '../api';
import { Trophy, Plus, Clock, ChevronRight, Trash2, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Home = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchMatches = () => {
    matchApi.list()
      .then(res => {
        setMatches(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleDelete = async (id) => {
    try {
      await matchApi.delete(id);
      setDeleteConfirm(null);
      fetchMatches();
    } catch (err) {
      alert("Failed to delete match");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative min-h-screen">
      <header className="flex justify-between items-center mb-10 mt-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="CricTracker Logo" className="w-16 h-16 object-contain" />
            <div>
              <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/40 tracking-tight">
                CricTracker
              </h1>
              <p className="text-primary text-xs font-bold uppercase tracking-[0.2em] opacity-80">Professional Scoring Suite</p>
            </div>
          </div>
        </motion.div>
        
        <Link to="/setup">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="glass-button flex items-center gap-2 primary-gradient border-none py-3 px-6"
          >
            <Plus className="w-5 h-5" />
            New Match
          </motion.button>
        </Link>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Recent Matches
        </h2>
        
        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card h-24 animate-pulse" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="glass-card text-center py-20">
            <p className="text-secondary mb-4">No matches found</p>
            <Link to="/setup" className="text-primary hover:underline">Start your first match</Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {matches.map((match, idx) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group relative"
              >
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
                  <button 
                    onClick={() => setDeleteConfirm(match)}
                    className="p-2 text-secondary/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <Link 
                    to={match.status === 'completed' ? `/summary/${match.id}` : `/scoring/${match.id}`}
                    className="p-3 bg-white/5 hover:bg-primary/20 rounded-xl transition-all"
                  >
                    <ChevronRight className="w-6 h-6 text-primary" />
                  </Link>
                </div>

                <div className="glass-card flex items-center justify-between p-6">
                  <div className="flex items-center gap-8">
                    <div className="text-center min-w-[100px]">
                      <p className="font-bold text-lg">{match.team1_name}</p>
                      <span className="text-[10px] text-secondary uppercase tracking-widest font-bold">Team A</span>
                    </div>
                    <div className="text-secondary font-black italic">VS</div>
                    <div className="text-center min-w-[100px]">
                      <p className="font-bold text-lg">{match.team2_name}</p>
                      <span className="text-[10px] text-secondary uppercase tracking-widest font-bold">Team B</span>
                    </div>
                  </div>
                  
                  <div className="mr-24 hidden sm:block text-right">
                    <div className="flex items-center gap-2 justify-end mb-1">
                      <span className={`w-2 h-2 rounded-full ${match.status === 'live' ? 'bg-green-500' : match.status === 'completed' ? 'bg-primary' : 'bg-secondary'}`} />
                      <p className="text-[10px] font-black uppercase tracking-widest text-secondary">
                        {match.status}
                      </p>
                    </div>
                    <p className="text-[10px] text-white/20 font-bold uppercase tabular-nums">
                      {new Date(match.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="glass-card max-w-sm w-full p-8 border-2 border-red-500/20"
            >
              <div className="flex items-center gap-4 text-red-500 mb-6">
                <AlertTriangle className="w-10 h-10" />
                <h3 className="text-2xl font-black uppercase italic">Wait!</h3>
              </div>
              <p className="text-secondary text-sm mb-8 leading-relaxed">
                Are you sure you want to delete the match between <span className="text-white font-bold">{deleteConfirm.team1_name}</span> and <span className="text-white font-bold">{deleteConfirm.team2_name}</span>? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 glass-button py-3 text-secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDelete(deleteConfirm.id)}
                  className="flex-1 glass-button py-3 bg-red-500/20 border-red-500/40 text-red-500 font-bold hover:bg-red-500 hover:text-white"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
