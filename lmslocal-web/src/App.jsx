import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Competition from './pages/Competition';
import RoundFixtures from './pages/RoundFixtures';
import PlayerCompetition from './pages/PlayerCompetition';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/competition/:id" element={<Competition />} />
        <Route path="/competition/:competitionId/round/:roundId/fixtures" element={<RoundFixtures />} />
        <Route path="/play/:slug" element={<PlayerCompetition />} />
      </Routes>
    </Router>
  );
}

export default App;