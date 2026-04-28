import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import MatchSetup from './pages/MatchSetup';
import Scoring from './pages/Scoring';
import Summary from './pages/Summary';
import Auth from './pages/Auth';
import ThemeToggle from './components/ThemeToggle';
import RequireAuth from './components/RequireAuth';
import { AuthProvider } from './auth';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Home />
                </RequireAuth>
              }
            />
            <Route
              path="/setup/:tournamentId"
              element={
                <RequireAuth>
                  <MatchSetup />
                </RequireAuth>
              }
            />
            <Route
              path="/scoring/:matchId"
              element={
                <RequireAuth>
                  <Scoring />
                </RequireAuth>
              }
            />
            <Route
              path="/summary/:matchId"
              element={
                <RequireAuth>
                  <Summary />
                </RequireAuth>
              }
            />
          </Routes>
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
