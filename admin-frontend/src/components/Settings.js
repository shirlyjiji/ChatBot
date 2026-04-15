import React, { useState, useEffect } from 'react';
import { Key, Copy, RefreshCw, CheckCircle, Code } from 'lucide-react';
import api from '../utils/api';

const Settings = ({ user }) => {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const WIDGET_URL = `${window.location.origin}/widget-loader.js`;

  useEffect(() => {
    fetchApiKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchApiKey = async () => {
    if (!user?.companyId) return;
    try {
      // Added cache buster ?t= to solve your 304 issue
      const res = await api.get(`/api/companies/${user.companyId}/api-key?t=${Date.now()}`);
      setApiKey(res.data.apiKey);
    } catch (err) {
      console.error("Error fetching API key");
    }
  };

  const handleGenerateKey = async () => {
    if (!window.confirm("Generating a new key will invalidate your old one. Continue?")) return;

    setLoading(true);
    try {
      const res = await api.post(`/api/companies/generate-api-key`, {
        companyId: user.companyId
      });
      setApiKey(res.data.apiKey);
    } catch (err) {
      alert("Failed to generate key");
    } finally {
      setLoading(false);
    }
  };

  // Improved copy function to handle different buttons
  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
  };

  const widgetScript = `<script 
  src="${WIDGET_URL}" 
  data-api-key="${apiKey || 'YOUR_API_KEY'}"
  async>
</script>
`;

  return (
    <div className="agents-view" style={{ padding: '20px' }}>
      <div className="view-header">
        <h1 className="view-title">Settings</h1>
        <p className="view-subtitle">Manage your company configuration and API access</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>

        {/* API KEY CARD */}
        <div className="card" style={{ padding: '24px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Key size={20} color="#2563eb" /> API Configuration
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              Use this key to integrate the FineChat widget into your website.
            </p>
          </div>

          <div className="api-key-container" style={{
            background: '#f9fafb',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <code style={{ fontSize: '14px', fontWeight: 'bold', color: apiKey ? '#111827' : '#9ca3af' }}>
              {apiKey || 'No API Key generated yet'}
            </code>

            {apiKey && (
              <button
                onClick={() => copyToClipboard(apiKey, 'key')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb' }}
              >
                {copied ? <CheckCircle size={20} color="#10b981" /> : <Copy size={20} />}
              </button>
            )}
          </div>

          <div style={{ marginTop: '20px' }}>
            <button
              className="primary-btn"
              onClick={handleGenerateKey}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RefreshCw size={18} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {apiKey ? 'Regenerate API Key' : 'Generate API Key'}
            </button>
          </div>
        </div>

        {/* WIDGET SCRIPT CARD */}
        {apiKey && (
          <div className="card" style={{ padding: '24px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #2563eb' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Code size={20} color="#2563eb" /> Widget Installation
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '15px' }}>
              Add this code to your website HTML to enable the chat bubble.
            </p>

            <div style={{ position: 'relative' }}>
              <pre style={{
                background: '#1e293b',
                color: '#f8fafc',
                padding: '20px',
                borderRadius: '8px',
                fontSize: '13px',
                overflowX: 'auto'
              }}>
                {widgetScript}
              </pre>

              <button
                onClick={() => copyToClipboard(widgetScript, 'script')}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: '#334155',
                  border: 'none',
                  color: 'white',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {copiedScript ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copiedScript ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;