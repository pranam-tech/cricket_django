import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../auth';

const initialRegister = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
};

const Auth = () => {
  const [mode, setMode] = useState('login');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState(initialRegister);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const destination = useMemo(() => location.state?.from || '/', [location.state]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(loginForm);
      } else {
        await register(registerForm);
      }
      navigate(destination, { replace: true });
    } catch (err) {
      const fallback = mode === 'login' ? 'Unable to sign in.' : 'Unable to create account.';
      setError(err.response?.data?.error || Object.values(err.response?.data || {})[0]?.[0] || fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-10 flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl grid lg:grid-cols-[1.1fr_0.9fr] gap-6"
      >
        <section className="glass-card rounded-2xl p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <p className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-4">CricTracker</p>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">Tournament control, live scoring, and match visibility by role.</h1>
            <p className="text-secondary max-w-2xl">
              Managers create tournaments and matches, scorekeepers run the live book, and users can follow everything without the control surface getting noisy.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mt-10">
            {[
              ['Manager', 'Create tournaments and schedule matches'],
              ['Scorekeeper', 'Run innings, overs, and live updates'],
              ['User', 'Browse tournaments and watch matches'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-foreground/10 bg-foreground/5 p-4">
                <p className="text-sm font-black mb-2">{title}</p>
                <p className="text-xs text-secondary leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card rounded-2xl p-8 sm:p-10">
          <div className="flex bg-foreground/5 p-1 rounded-2xl border border-foreground/10 mb-8">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-[0.2em] ${mode === 'login' ? 'primary-gradient' : 'text-secondary'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-[0.2em] ${mode === 'register' ? 'accent-gradient' : 'text-secondary'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <Field label="Username">
                  <input value={registerForm.username} onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })} className="input" required />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="First name">
                    <input value={registerForm.first_name} onChange={(e) => setRegisterForm({ ...registerForm, first_name: e.target.value })} className="input" />
                  </Field>
                  <Field label="Last name">
                    <input value={registerForm.last_name} onChange={(e) => setRegisterForm({ ...registerForm, last_name: e.target.value })} className="input" />
                  </Field>
                </div>
                <Field label="Email">
                  <input type="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} className="input" />
                </Field>
                <Field label="Password">
                  <input type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} className="input" required minLength={6} />
                </Field>
              </>
            )}

            {mode === 'login' && (
              <>
                <Field label="Username">
                  <input value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} className="input" required />
                </Field>
                <Field label="Password">
                  <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="input" required />
                </Field>
              </>
            )}

            {error && (
              <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                {error}
              </div>
            )}

            <button
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-2 ${mode === 'login' ? 'primary-gradient' : 'accent-gradient'}`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </>
              )}
            </button>
          </form>
        </section>
      </motion.div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-[11px] font-black uppercase tracking-[0.22em] text-secondary block mb-2">{label}</span>
    {children}
  </label>
);

export default Auth;
