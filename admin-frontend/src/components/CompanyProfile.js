import React, { useState, useEffect } from 'react';
import { Users, Trash2, Edit2, X, Plus } from 'lucide-react';
import api from '../utils/api';
import './CompanyProfile.css';

const CompanyProfile = ({ user }) => {
  const [companies, setCompanies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    companyName: '',
    username: '',
    password: '',
    allowedAgents: 5
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await api.get(`/api/companies`);
      setCompanies(res.data);
    } catch (err) {
      console.error("Error fetching companies", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, requesterRole: 'admin' };

      if (editingId) {
        await api.put(`/api/companies/${editingId}`, payload);
      } else {
        await api.post(`/api/companies/create`, payload);
      }

      setShowModal(false);
      setEditingId(null);
      setFormData({ companyName: '', username: '', password: '', allowedAgents: 5 });
      fetchCompanies();
    } catch (err) {
      console.log(err);
      alert(err.response?.data?.message || "Operation failed");
    }
  };

  const handleEdit = (company) => {
    setEditingId(company._id);
    setFormData({
      companyName: company.companyName,
      username: company.username,
      password: '',
      allowedAgents: company.allowedAgents
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure? This will delete the company and all its agents.")) {
      await api.delete(`/api/companies/${id}`);
      fetchCompanies();
    }
  };

  return (
    <div className="company-profiles-wrapper">
      <div className="cp-header">
        <h1>Company Profiles</h1>
        <button className="cp-add-btn" onClick={() => { setEditingId(null); setFormData({ companyName: '', username: '', password: '', allowedAgents: 5 }); setShowModal(true); }}>
          <Plus size={18} /> Add New Company
        </button>
      </div>

      <div className="cp-card">
        <table className="cp-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Admin Username</th>
              <th>Agent Limit</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c._id}>
                <td>
                  <div className="cp-company-info">
                    <div className="cp-avatar">{c.companyName.charAt(0).toUpperCase()}</div>
                    <span className="cp-company-name">{c.companyName}</span>
                  </div>
                </td>
                <td>{c.username}</td>
                <td>
                  <div className="cp-agent-limit">
                    <Users size={16} /> {c.allowedAgents}
                  </div>
                </td>
                <td>
                  <span className="cp-status-pill">Active</span>
                </td>
                <td>
                  <div className="cp-actions" style={{ justifyContent: 'flex-end' }}>
                    <button className="cp-action-btn edit" onClick={() => handleEdit(c)}>
                      <Edit2 size={16} />
                    </button>
                    <button className="cp-action-btn delete" onClick={() => handleDelete(c._id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="cp-modal-overlay">
          <div className="cp-modal-content">
            <div className="cp-modal-header">
              <h3>{editingId ? 'Edit Company' : 'New Company Profile'}</h3>
              <button className="cp-modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="cp-modal-body">
                <div className="cp-input-group">
                  <label>Company Name</label>
                  <input
                    placeholder="e.g. Acme Corp"
                    value={formData.companyName}
                    onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                    required
                  />
                </div>
                <div className="cp-input-group">
                  <label>Admin Username</label>
                  <input
                    placeholder="e.g. acme_admin"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>
                <div className="cp-input-group">
                  <label>Admin Password {editingId && <span style={{ fontSize: '10px', textTransform: 'none', fontWeight: 'normal' }}>(leave blank to keep current)</span>}</label>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    required={!editingId}
                  />
                </div>
                <div className="cp-input-group">
                  <label>Allowed Agents</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.allowedAgents}
                    onChange={e => setFormData({ ...formData, allowedAgents: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="cp-modal-footer">
                <button type="button" className="cp-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="cp-add-btn" style={{ margin: 0 }}>
                  {editingId ? 'Update Profile' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyProfile;