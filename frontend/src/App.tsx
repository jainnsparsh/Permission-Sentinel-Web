import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, Search, FileText, Lock, Info, GitCompare } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Analyze from './pages/Analyze';
import AppDetail from './pages/AppDetail';
import Evolution from './pages/Evolution';
import Policies from './pages/Policies';
import Privacy from './pages/Privacy';
import './index.css';

function Sidebar() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={28} style={{ color: 'var(--accent-amber)' }} />
          <div>
            <h1>Permission Sentinel</h1>
            <p>Android Permission Auditor</p>
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" className={`nav-link ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}>
          <LayoutDashboard size={18} />
          Dashboard
        </NavLink>
        <NavLink to="/analyze" className={`nav-link ${isActive('/analyze') ? 'active' : ''}`}>
          <Search size={18} />
          Analyze App
        </NavLink>
        <NavLink to="/evolution" className={`nav-link ${isActive('/evolution') ? 'active' : ''}`}>
          <GitCompare size={18} />
          Update Watch
        </NavLink>
        <NavLink to="/policies" className={`nav-link ${isActive('/policies') ? 'active' : ''}`}>
          <FileText size={18} />
          Policies
        </NavLink>
        <NavLink to="/privacy" className={`nav-link ${isActive('/privacy') ? 'active' : ''}`}>
          <Lock size={18} />
          Privacy & Info
        </NavLink>
      </nav>
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <Info size={14} />
          <span>v1.0.0 · KB v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <Router>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/app/:id" element={<AppDetail />} />
            <Route path="/evolution" element={<Evolution />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
