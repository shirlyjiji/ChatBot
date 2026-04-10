import React, { useState, useEffect } from "react";
import { Pencil, Trash2 } from 'lucide-react';
import api from '../utils/api';
import './Agent.css';

export default function Agents({ user }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [error, setError] = useState('');

  // 1. Fetch Agents on Load
  useEffect(() => {
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      // If super-admin, fetch all. If company admin, fetch only theirs.
      const url = user.role === 'super-admin'
        ? `/api/agents/all`
        : `/api/agents/company/${user.companyId}`;

      const res = await api.get(url);
      setAgents(res.data);
    } catch (err) {
      console.error("Error fetching agents:", err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingAgent(null);
    setError('');
    setShowModal(true);
  };

  const openEdit = (agent) => {
    setEditingAgent(agent);
    setError('');
    setShowModal(true);
  };

  // 2. Delete Agent from DB
  const deleteAgent = async (id) => {
    if (window.confirm("Are you sure you want to delete this agent?")) {
      try {
        await api.delete(`/api/agents/${id}`);
        setAgents(agents.filter((a) => a._id !== id));
      } catch (err) {
        alert("Delete failed");
      }
    }
  };

  // 3. Save or Update Agent in DB
  const saveAgent = async (e) => {
    e.preventDefault();
    const form = e.target;
    setError('');

    const agentData = {
      companyId: user.companyId, // Tied to logged-in company
      name: form.name.value,
      username: form.username.value,
      email: form.email.value,
      password: form.password.value,
      contact: form.contact.value,
      status: form.status.value,
    };

    try {
      if (editingAgent) {
        // Update
        const res = await api.put(`/api/agents/${editingAgent._id}`, agentData);
        setAgents(agents.map((a) => (a._id === editingAgent._id ? res.data : a)));
      } else {
        // Create (This will trigger the "Allowed Agents" check on backend)
        const res = await api.post(`/api/agents/create`, agentData);
        setAgents([...agents, res.data]);
      }
      setShowModal(false);
    } catch (err) {
      setError(err.response?.data?.message || "Error saving agent");
    }
  };

  if (loading) return <div className="agents-view">Loading Agents...</div>;

  return (
    <div className="agents-view">
      <div className="view-header">
        <h1>Agents Management</h1>
        {/* Only Company Admins can create agents in this view */}
        {user.role === 'admin' && (
          <button className="primary-btn" onClick={openCreate}>
            + Create Agent
          </button>
        )}
      </div>

      <div className="card">
        <table className="agents-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Username</th>
              <th>Email</th>
              <th>Status</th>
              <th>Contact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent._id}>
                <td className="agent-info">
                  <div className="avatar">
                    {(agent.name || agent.username).charAt(0)}
                  </div>
                  <span>{agent.name || agent.username}</span>
                </td>
                <td>{agent.username}</td>
                <td>{agent.email || 'N/A'}</td>
                <td>
                  <span className={`status ${agent.status || 'active'}`}>
                    {agent.status === "deactive" ? "Deactive" : "Active"}
                  </span>
                </td>
                <td>{agent.contact || 'N/A'}</td>
                <td className="actions">
                  <button className="table-icon-btn table-edit-btn" title="Edit Agent" onClick={() => openEdit(agent)}>
                    <Pencil size={18} />
                  </button>
                  <button className="table-icon-btn table-delete-btn" title="Delete Agent" onClick={() => deleteAgent(agent._id)}>
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {agents.length === 0 && <p style={{ textAlign: 'center', padding: '20px' }}>No agents found.</p>}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingAgent ? "Edit Agent" : "Create Agent"}</h2>
            {error && <p style={{ color: 'red', fontSize: '14px' }}>{error}</p>}

            <form onSubmit={saveAgent} className="agent-form">
              <input name="name" defaultValue={editingAgent?.name} placeholder="Full Name" required />
              <input name="username" defaultValue={editingAgent?.username} placeholder="Username" required />
              <input name="email" type="email" defaultValue={editingAgent?.email} placeholder="Email" />
              <input name="password" type="password" placeholder={editingAgent ? "Leave blank to keep same" : "Password"} required={!editingAgent} />
              <input name="contact" defaultValue={editingAgent?.contact} placeholder="Contact Number" />

              <select name="status" defaultValue={editingAgent?.status || "active"}>
                <option value="active">Active</option>
                <option value="deactive">Deactive</option>
              </select>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}