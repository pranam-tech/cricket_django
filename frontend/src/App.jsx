import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import MatchSetup from './pages/MatchSetup';
import Scoring from './pages/Scoring';
import Summary from './pages/Summary';
import ThemeToggle from './components/ThemeToggle';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<MatchSetup />} />
          <Route path="/scoring/:matchId" element={<Scoring />} />
          <Route path="/summary/:matchId" element={<Summary />} />
        </Routes>
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
      </div>
    </Router>
  );
}

export default App;
