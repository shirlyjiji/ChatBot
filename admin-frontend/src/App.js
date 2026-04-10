import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Agents from './components/Agents'; // Use this for Agent Management
import ChatBotBuilder from './components/ChatBotBuilder';
import ChatHistory from './components/ChatHistory';
import CompanyProfile from './components/CompanyProfile';
import Settings from './components/Settings';
import Appointments from './components/AppointmentCalendar'
import './App.css';

export default function App() {
  // Initialize from localStorage so refresh doesn't log you out
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('app_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLogin = (userData) => {
    localStorage.setItem('token', userData.token);
    localStorage.setItem('app_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('app_user');
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        {/* Login Page */}
        <Route path="/login" element={
          !user ? <Login onLogin={handleLogin} /> : <Navigate to="/" />
        } />

        {/* Protected Dashboard Layout */}
        <Route path="/" element={
          user ? <Layout user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
        }>
          {/* Default Dashboard */}
          <Route index element={<Dashboard user={user} />} />

          {/* Company Profile - ONLY for Super Admin */}
          {user?.role === 'super-admin' && (
            <Route path="companies" element={<CompanyProfile />} />
          )}

          {/* Agents Management - For Super Admin and Company Admin */}
          <Route path="agents" element={<Agents user={user} />} />

          {/* Existing Routes */}
          <Route path="builder" element={<ChatBotBuilder user={user} />} />
          <Route path="history" element={<ChatHistory user={user} />} />
          <Route path="settings" element={<Settings user={user} />} />
          <Route path="appointments" element={<Appointments user={user} />} />
        </Route>
      </Routes>
    </Router>
  );
}