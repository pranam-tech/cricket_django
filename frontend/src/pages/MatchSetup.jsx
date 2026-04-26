import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Plus, Settings, User, Users, X } from 'lucide-react';
import { matchApi, tournamentApi } from '../api';
import { useAuth } from '../auth';

const MatchSetup = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const [tournament, setTournament] = useState(null);
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    tournamentApi.get(tournamentId)
      .then((res) => {
        setTournament(res.data);
        setFormData((current) => ({
          ...current,
          overs: res.data.overs_per_match,
        }));
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [navigate, tournamentId]);

  const addPlayer = (teamNo) => {
    if (teamNo === 1 && newPlayer1.trim()) {
      setTeam1Players([...team1Players, newPlayer1.trim()]);
      setNewPlayer1('');
    }
    if (teamNo === 2 && newPlayer2.trim()) {
      setTeam2Players([...team2Players, newPlayer2.trim()]);
      setNewPlayer2('');
    }
  };

  const removePlayer = (teamNo, index) => {
    if (teamNo === 1) {
      setTeam1Players(team1Players.filter((_, playerIndex) => playerIndex !== index));
    } else {
      setTeam2Players(team2Players.filter((_, playerIndex) => playerIndex !== index));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isManager) {
      alert('Only managers can create matches inside tournaments.');
      return;
    }

    setSaving(true);
    try {
      const res = await matchApi.create({
        ...formData,
        tournament_id: tournamentId,
        team1_players: team1Players,
        team2_players: team2Players,
      });
      navigate(`/scoring/${res.data.id}`);
    } catch (error) {
      alert(error.response?.data?.error || 'Unable to create match.');
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-background"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!isManager) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="glass-card text-center p-10">
          <h2 className="text-2xl font-black mb-3">Manager access only</h2>
          <p className="text-secondary mb-6">Only managers can add matches to tournaments.</p>
          <Link to="/" className="glass-button primary-gradient py-3 px-5 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="glass-button p-3">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary mb-1">{tournament?.name}</p>
          <h1 className="text-3xl font-black">Add Match</h1>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="glass-card">
        <div className="flex items-start gap-3 mb-8">
          <div className="p-3 primary-gradient rounded-xl shrink-0">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black">Match Setup</h2>
            <p className="text-secondary text-sm mt-1">This match will be created inside the selected tournament.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid sm:grid-cols-2 gap-4 p-5 rounded-2xl border border-foreground/10 bg-foreground/5">
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-secondary block mb-2">Overs</span>
              <input
                type="number"
                min="1"
                value={formData.overs}
                onChange={(e) => setFormData({ ...formData, overs: Number(e.target.value) })}
                className="input"
                required
              />
            </label>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, last_man_stands: !formData.last_man_stands })}
              className="rounded-2xl border border-foreground/10 bg-foreground/5 px-5 py-4 text-left"
            >
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-secondary mb-2">Last Man Stands</p>
              <p className="font-bold">{formData.last_man_stands ? 'Enabled' : 'Disabled'}</p>
            </button>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <TeamEditor
              label="Home Team"
              teamName={formData.team1_name}
              onTeamNameChange={(value) => setFormData({ ...formData, team1_name: value })}
              players={team1Players}
              newPlayer={newPlayer1}
              setNewPlayer={setNewPlayer1}
              onAdd={() => addPlayer(1)}
              onRemove={(index) => removePlayer(1, index)}
            />
            <TeamEditor
              label="Away Team"
              teamName={formData.team2_name}
              onTeamNameChange={(value) => setFormData({ ...formData, team2_name: value })}
              players={team2Players}
              newPlayer={newPlayer2}
              setNewPlayer={setNewPlayer2}
              onAdd={() => addPlayer(2)}
              onRemove={(index) => removePlayer(2, index)}
            />
          </div>

          <button disabled={saving} className="w-full py-4 rounded-2xl primary-gradient font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
            {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Play className="w-5 h-5" /> Start Match</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const TeamEditor = ({ label, teamName, onTeamNameChange, players, newPlayer, setNewPlayer, onAdd, onRemove }) => (
  <section className="space-y-4">
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-secondary block mb-2">{label}</span>
      <input value={teamName} onChange={(e) => onTeamNameChange(e.target.value)} className="input text-lg font-bold" required />
    </label>

    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-secondary flex items-center gap-2 mb-3">
        <Users className="w-4 h-4" /> Players ({players.length})
      </p>
      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
        <AnimatePresence>
          {players.map((player, index) => (
            <motion.div
              key={`${player}-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <User className="w-4 h-4 text-secondary shrink-0" />
                <span className="font-medium truncate">{player}</span>
              </div>
              <button type="button" onClick={() => onRemove(index)} className="p-1 text-secondary hover:text-accent">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex gap-2 mt-3">
        <input
          value={newPlayer}
          onChange={(e) => setNewPlayer(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd())}
          placeholder="Add player"
          className="input"
        />
        <button type="button" onClick={onAdd} className="glass-button primary-gradient px-4">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  </section>
);

export default MatchSetup;
