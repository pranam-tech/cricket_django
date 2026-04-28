import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ShieldCheck,
  Trophy,
  Clock,
  ChevronRight,
  Send,
  CheckCircle2,
  XCircle,
  LogOut,
} from 'lucide-react';
import { matchApi, scorekeeperRequestApi, tournamentApi } from '../api';
import { useAuth } from '../auth';
import ThemeToggle from '../components/ThemeToggle';

const roleLabel = {
  admin: 'Admin',
  manager: 'Manager',
  scorekeeper: 'Scorekeeper',
  user: 'User',
};

const Home = () => {
  const { user, userType, isManager, logout, refreshUser } = useAuth();
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestingRole, setRequestingRole] = useState(false);
  const [showTournamentForm, setShowTournamentForm] = useState(false);
  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    format: 'league',
    overs_per_match: 20,
    players_per_team: 11,
  });

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [matchesRes, tournamentsRes, requestsRes] = await Promise.all([
        matchApi.list(),
        tournamentApi.list(),
        scorekeeperRequestApi.list(),
      ]);
      setMatches(matchesRes.data);
      setTournaments(tournamentsRes.data);
      setRequests(requestsRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const pendingOwnRequest = useMemo(
    () => requests.find((request) => request.status === 'pending' && request.user?.id === user?.id),
    [requests, user?.id]
  );

  const handleCreateTournament = async (event) => {
    event.preventDefault();
    try {
      await tournamentApi.create(tournamentForm);
      setTournamentForm({ name: '', format: 'league', overs_per_match: 20, players_per_team: 11 });
      setShowTournamentForm(false);
      await loadDashboard();
    } catch (error) {
      alert(error.response?.data?.detail || 'Unable to create tournament.');
    }
  };

  const handleRequestScorekeeper = async () => {
    setRequestingRole(true);
    try {
      await scorekeeperRequestApi.create({
        message: 'Requesting scorekeeper access to help run live matches.',
      });
      await loadDashboard();
    } catch (error) {
      alert(error.response?.data?.non_field_errors?.[0] || error.response?.data?.detail || 'Unable to send request.');
    } finally {
      setRequestingRole(false);
    }
  };

  const reviewRequest = async (id, action) => {
    try {
      if (action === 'approve') {
        await scorekeeperRequestApi.approve(id);
      } else {
        await scorekeeperRequestApi.reject(id);
      }
      await loadDashboard();
      await refreshUser();
    } catch (error) {
      alert(error.response?.data?.error || 'Unable to review request.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 pt-6">
      <header className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 mb-8">
        <div className="flex items-start gap-4">
          <img src="/logo.png" alt="CricTracker Logo" className="w-14 h-14 object-contain shrink-0" />
          <div>
            <p className="text-primary text-xs font-black uppercase tracking-[0.28em] mb-2">CricTracker</p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Tournaments, matches, and live scoring in one lane.</h1>
            <p className="text-secondary mt-2 max-w-2xl">
              Signed in as <span className="text-foreground font-bold">{user?.full_name}</span> with the <span className="text-primary font-bold">{roleLabel[userType]}</span> role.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isManager && (
            <button onClick={() => setShowTournamentForm((value) => !value)} className="glass-button primary-gradient py-3 px-5 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Tournament
            </button>
          )}
          {userType === 'user' && (
            <button
              onClick={handleRequestScorekeeper}
              disabled={Boolean(pendingOwnRequest) || requestingRole}
              className="glass-button py-3 px-5 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {pendingOwnRequest ? 'Request Pending' : 'Request Scorekeeper Access'}
            </button>
          )}
          <button onClick={logout} className="glass-button py-3 px-4 flex items-center gap-2 text-secondary">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
          <div className="sm:hidden">
            <ThemeToggle isInline />
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showTournamentForm && (
          <motion.form
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            onSubmit={handleCreateTournament}
            className="glass-card grid lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 mb-8"
          >
            <input
              value={tournamentForm.name}
              onChange={(e) => setTournamentForm({ ...tournamentForm, name: e.target.value })}
              placeholder="Tournament name"
              className="input"
              required
            />
            <select
              value={tournamentForm.format}
              onChange={(e) => setTournamentForm({ ...tournamentForm, format: e.target.value })}
              className="input"
            >
              <option value="league">League</option>
              <option value="knockout">Knockout</option>
            </select>
            <input
              type="number"
              min="1"
              value={tournamentForm.overs_per_match}
              onChange={(e) => setTournamentForm({ ...tournamentForm, overs_per_match: Number(e.target.value) })}
              className="input"
              required
            />
            <input
              type="number"
              min="2"
              value={tournamentForm.players_per_team}
              onChange={(e) => setTournamentForm({ ...tournamentForm, players_per_team: Number(e.target.value) })}
              className="input"
              required
            />
            <button className="glass-button primary-gradient px-5 py-3 font-black uppercase text-xs tracking-[0.2em]">
              Create
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid xl:grid-cols-[1.65fr_1fr] gap-6">
        <section className="space-y-6">
          <SectionTitle icon={Trophy} title="Tournaments" subtitle="Create, browse, and launch matches inside tournament lanes." />
          {loading ? (
            <LoadingStack count={3} />
          ) : tournaments.length === 0 ? (
            <EmptyState text="No tournaments yet." />
          ) : (
            tournaments.map((tournament) => (
              <div key={tournament.id} className="glass-card p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary mb-2">{tournament.format}</p>
                    <h2 className="text-2xl font-black">{tournament.name}</h2>
                    <p className="text-secondary text-sm mt-1">
                      {tournament.matches_count} matches, {tournament.live_matches_count} live, {tournament.overs_per_match} overs, {tournament.players_per_team} players per side.
                    </p>
                  </div>
                  {isManager && (
                    <Link
                      to={`/setup/${tournament.id}`}
                      className="glass-button primary-gradient py-3 px-4 font-black text-xs uppercase tracking-[0.18em] inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Match
                    </Link>
                  )}
                </div>

                <div className="grid gap-3">
                  {(matches.filter((match) => match.tournament === tournament.id)).length === 0 ? (
                    <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-5 text-sm text-secondary">
                      No matches scheduled in this tournament yet.
                    </div>
                  ) : (
                    matches
                      .filter((match) => match.tournament === tournament.id)
                      .map((match) => (
                        <Link
                          key={match.id}
                          to={match.status === 'completed' ? `/summary/${match.id}` : `/scoring/${match.id}`}
                          className="rounded-xl border border-foreground/10 bg-foreground/5 p-4 hover:bg-foreground/10 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-black">{match.team1_name} vs {match.team2_name}</p>
                              <p className="text-xs text-secondary uppercase tracking-[0.18em] mt-1">{match.status}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-primary shrink-0" />
                          </div>
                        </Link>
                      ))
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        <aside className="space-y-6">
          <SectionTitle icon={ShieldCheck} title="Access" subtitle="Role-specific work queue and promotion state." />

          <div className="glass-card p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-secondary mb-3">Your access</p>
            <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-4">
              <p className="text-lg font-black">{roleLabel[userType]}</p>
              <p className="text-sm text-secondary mt-1">
                {userType === 'manager' && 'You can create tournaments and add matches to them.'}
                {userType === 'scorekeeper' && 'You can watch live matches and update scoring actions.'}
                {userType === 'user' && 'You can browse tournaments, follow matches, and request scorekeeper access.'}
                {userType === 'admin' && 'You have full access across management and scoring workflows.'}
              </p>
            </div>
          </div>

          {isManager ? (
            <div className="glass-card p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-secondary mb-4">Scorekeeper requests</p>
              <div className="space-y-3">
                {requests.filter((request) => request.status === 'pending').length === 0 ? (
                  <p className="text-sm text-secondary">No pending requests right now.</p>
                ) : (
                  requests
                    .filter((request) => request.status === 'pending')
                    .map((request) => (
                      <div key={request.id} className="rounded-xl border border-foreground/10 bg-foreground/5 p-4">
                        <p className="font-black">{request.user?.full_name}</p>
                        <p className="text-sm text-secondary mt-1">{request.message || 'No message included.'}</p>
                        <div className="flex gap-2 mt-4">
                          <button onClick={() => reviewRequest(request.id, 'approve')} className="glass-button primary-gradient flex-1 py-3 text-xs font-black uppercase tracking-[0.18em] flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Approve
                          </button>
                          <button onClick={() => reviewRequest(request.id, 'reject')} className="glass-button flex-1 py-3 text-xs font-black uppercase tracking-[0.18em] text-accent flex items-center justify-center gap-2">
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          ) : (
            <div className="glass-card p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-secondary mb-4">Promotion requests</p>
              <div className="space-y-3">
                {requests.length === 0 ? (
                  <p className="text-sm text-secondary">No requests on record yet.</p>
                ) : (
                  requests.map((request) => (
                    <div key={request.id} className="rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
                      <p className="font-black capitalize">{request.status}</p>
                      <p className="text-sm text-secondary mt-1">{request.message || 'No message included.'}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="glass-card p-5">
            <SectionTitle icon={Clock} title="Recent Matches" subtitle={`${matches.length} total visible matches`} compact />
            <div className="space-y-3 mt-4">
              {matches.slice(0, 5).map((match) => (
                <Link
                  key={match.id}
                  to={match.status === 'completed' ? `/summary/${match.id}` : `/scoring/${match.id}`}
                  className="block rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3 hover:bg-foreground/10 transition-colors"
                >
                  <p className="font-black">{match.team1_name} vs {match.team2_name}</p>
                  <p className="text-xs text-secondary uppercase tracking-[0.18em] mt-1">
                    {match.tournament_name} • {match.status}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const SectionTitle = ({ icon: Icon, title, subtitle, compact = false }) => (
  <div className={compact ? '' : 'mb-2'}>
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-4 h-4 text-primary" />
      <h2 className="text-lg font-black">{title}</h2>
    </div>
    <p className="text-sm text-secondary">{subtitle}</p>
  </div>
);

const EmptyState = ({ text }) => (
  <div className="glass-card text-center py-16 text-secondary">{text}</div>
);

const LoadingStack = ({ count }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="glass-card h-32 animate-pulse" />
    ))}
  </div>
);

export default Home;
