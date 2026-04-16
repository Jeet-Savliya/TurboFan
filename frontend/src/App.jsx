import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Predict from "./pages/Predict";
import Analytics from "./pages/Analytics";
import About from "./pages/About";

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">✈</span>
        <h2>Deep Temporal<br />Analytics</h2>
        <p>RUL Estimation v1.0</p>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" end>
          <span className="nav-icon">◉</span> Dashboard
        </NavLink>
        <NavLink to="/predict">
          <span className="nav-icon">⚡</span> RUL Predictor
        </NavLink>
        <NavLink to="/analytics">
          <span className="nav-icon">📊</span> Analytics
        </NavLink>
        <NavLink to="/about">
          <span className="nav-icon">ℹ</span> About
        </NavLink>
      </nav>

      <div className="sidebar-status">
        <span className="status-dot" />
        LSTM ENSEMBLE ONLINE
        <br />
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
          4 Expert Models Active
        </span>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/predict" element={<Predict />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
