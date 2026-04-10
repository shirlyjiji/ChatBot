import React, { useState, useEffect } from 'react';
import { Users, Building2, MessageSquare, ShieldCheck } from 'lucide-react';
import api from '../utils/api';
export default function Dashboard({ user }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Prevent API calls if user is not yet loaded
    if (!user) return;

    const fetchStats = async () => {
      try {
        let endpoint = user.role === 'super-admin'
          ? '/api/super/stats'
          : `/api/companies/${user.companyId}/stats`;

        const res = await api.get(endpoint);

        if (user.role === 'super-admin') {
          setStats([
            { label: 'Total Companies', value: res.data.companyCount, icon: <Building2 />, color: '#8b5cf6' },
            { label: 'Total Agents', value: res.data.agentCount, icon: <Users />, color: '#3b82f6' },
          ]);
        } else {
          setStats([
            { label: 'Active Agents', value: res.data.currentAgents, icon: <Users />, color: '#3b82f6' },
            { label: 'Agent Limit', value: res.data.allowedAgents, icon: <ShieldCheck />, color: '#10b981' },
            { label: 'Flows Created', value: res.data.flowCount, icon: <MessageSquare />, color: '#f59e0b' },
          ]);
        }
      } catch (err) {
        console.error("Dashboard Stats Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  // FIX: Early return if user object is missing
  if (!user) return <div className="p-6">Authenticating...</div>;
  if (loading) return <div className="p-6">Loading Dashboard Data...</div>;

  return (
    <div className="dashboard-view">
      <h1 className="view-title">
        Welcome, {user.role === 'admin' ? user.companyName : user.username}
      </h1>
      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ color: stat.color }}>
              {React.cloneElement(stat.icon, { size: 28 })}
            </div>
            <div className="stat-info">
              <h3>{stat.value}</h3>
              <p>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}