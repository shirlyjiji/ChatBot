import React, { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2, // Icon for Company Profile
  History,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CalendarDays,
  Bot,
  Menu,
  X
} from 'lucide-react';

const Layout = ({ onLogout, user }) => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="main-layout">
      {/* Mobile Top Bar */}
      <div className="mobile-top-bar">
        <div className="sidebar-logo">FineChat</div>
        <button
          className="mobile-menu-btn"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
        >
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      <div
        className={`sidebar-overlay ${isMobileOpen ? 'active' : ''}`}
        onClick={() => setIsMobileOpen(false)}
      />

      <aside className={`sidebar-nav ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          {!isCollapsed && <div className="sidebar-logo">FineChat</div>}
          <button
            className="collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {!isCollapsed && (
          <div className="user-info-badge">
            <div className="user-info-inner">
              <div className="user-role">
                <ShieldCheck size={14} />
                <span>{user?.role}</span>
              </div>
              <div className="user-name">{user?.username}</div>
            </div>
          </div>
        )}

        <nav className="nav-menu">
          <NavLink
            to="/"
            className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            onClick={() => setIsMobileOpen(false)}
          >
            <LayoutDashboard size={20} />
            {!isCollapsed && <span>Dashboard</span>}
          </NavLink>

          {user?.role === 'super-admin' && (
            <NavLink
              to="/companies"
              className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
              onClick={() => setIsMobileOpen(false)}
            >
              <Building2 size={20} />
              {!isCollapsed && <span>Company Profiles</span>}
            </NavLink>
          )}

          <NavLink
            to="/agents"
            className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            onClick={() => setIsMobileOpen(false)}
          >
            <Users size={20} />
            {!isCollapsed && <span>Agents</span>}
          </NavLink>

          <NavLink
            to="/builder"
            className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            onClick={() => setIsMobileOpen(false)}
          >
            <Bot size={20} />
            {!isCollapsed && <span>Bot Builder</span>}
          </NavLink>

          <NavLink
            to="/history"
            className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            onClick={() => setIsMobileOpen(false)}
          >
            <History size={20} />
            {!isCollapsed && <span>Chat History</span>}
          </NavLink>

          <NavLink
            to="/appointments"
            className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            onClick={() => setIsMobileOpen(false)}
          >
            <CalendarDays size={20} />
            {!isCollapsed && <span>Appointments</span>}
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            onClick={() => setIsMobileOpen(false)}
          >
            <Settings size={20} />
            {!isCollapsed && <span>Settings</span>}
          </NavLink>

          <div
            className="nav-item logout"
            onClick={() => {
              handleLogout();
              setIsMobileOpen(false);
            }}
          >
            <LogOut size={20} />
            {!isCollapsed && <span>Logout</span>}
          </div>
        </nav>
      </aside>

      <main className="content-area">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;