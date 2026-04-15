import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import './App.css';
import { getMsgTs, formatTime, formatDayLabel } from './utils/chatTime';
const API = process.env.REACT_APP_API_BASE_URL;
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;

const api = axios.create({
  baseURL: API
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agent_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});


export default function App() {
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callTimerRef = useRef(null);

  // ---------------- AUTH ----------------
  const [agent, setAgent] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // ---------------- CHAT STATE ----------------
  const [waiting, setWaiting] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [chatHistory, setChatHistory] = useState([]);

  // UI helpers
  const [showAccept, setShowAccept] = useState(null);

  const [online, setOnline] = useState(false);
  const [viewingHistory, setViewingHistory] = useState(false);

  const [audioCallRequest, setAudioCallRequest] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle | in-call
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callConversationId, setCallConversationId] = useState(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);


  const setupSocketListeners = (socket, currentAgent) => {
    console.log('Setting up socket listeners for agent:', currentAgent?.username);

    socket.on('connect', () => {
      console.log('✅ Socket connected');
      restoreActiveChat();
    });

    socket.on('message', msg => {
      console.log('📩 New message received:', msg);
      setMessages(prev => [...prev, msg]);
    });

    socket.on('chatEnded', () => {
      console.log('🚫 Chat ended');
      setTimeout(() => {
        localStorage.removeItem('agent_active_conversation');
        setActive(null);
        setMessages([]);
      }, 8000);
    });

    socket.on('incomingAudioCall', ({ conversationId, companyId }) => {
      console.log('📞 Incoming audio call request for convo:', conversationId, 'company:', companyId);
      if (companyId && currentAgent?.companyId?.toString() !== companyId) {
        console.log('❌ Company mismatch, ignoring call');
        return;
      }
      setAudioCallRequest(conversationId);
    });

    socket.on('webrtc-offer', async ({ conversationId: cid, offer }) => {
      console.log('📡 Received webrtc-offer for convo:', cid);
      try {
        console.log('🎤 Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone access granted');

        localStreamRef.current = stream;
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerRef.current = pc;

        stream.getTracks().forEach(t => pc.addTrack(t, stream));
        pc.ontrack = (e) => {
          console.log('🔊 Remote track received');
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            console.log('❄️ Sending ICE candidate');
            socket.emit('webrtc-ice-candidate', { conversationId: cid, candidate: e.candidate });
          }
        };

        console.log('⚙️ Setting remote description...');
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('⚙️ Creating answer...');
        const answer = await pc.createAnswer();
        console.log('⚙️ Setting local description...');
        await pc.setLocalDescription(answer);

        console.log('📤 Sending webrtc-answer');
        socket.emit('webrtc-answer', { conversationId: cid, answer });

        console.log('✨ Transitioning to in-call state');
        setCallState('in-call');
        setCallConversationId(cid);

        if (callTimerRef.current) clearInterval(callTimerRef.current);
        let sec = 0;
        callTimerRef.current = setInterval(() => {
          sec++;
          setCallDuration(sec);
        }, 1000);
      } catch (err) {
        console.error('❌ Agent failed to initialize WebRTC:', err);
        socket.emit('endAudioCall', { conversationId: cid });
        agentCleanupCall();
        alert('Failed to access microphone. The call has been ended.');
      }
    });

    socket.on('webrtc-ice-candidate', async ({ candidate }) => {
      console.log('❄️ Received remote ICE candidate');
      if (peerRef.current && candidate) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    });

    socket.on('audioCallEnded', () => {
      console.log('📵 Audio call ended by remote');
      agentCleanupCall();
    });

    socket.on('connect_error', err => {
      console.error('🔌 Socket connection error:', err.message);
      if (
        err.message.includes('Session replaced') ||
        err.message.includes('Unauthorized') ||
        err.message.includes('Missing token')
      ) {
        localStorage.removeItem('agent_token');
        setAgent(null);
      }
    });
  };

  useEffect(() => {
    const token = localStorage.getItem('agent_token');
    if (!token) return;

    (async () => {
      try {
        const res = await api.get('/api/agents/me');
        const loadedAgent = res.data;
        setAgent(loadedAgent);
        setOnline(loadedAgent.online);

        if (socketRef.current) socketRef.current.disconnect();

        const socket = io(`${SOCKET_URL}/agent`, {
          auth: { token }
        });
        socketRef.current = socket;
        setupSocketListeners(socket, loadedAgent);

      } catch (e) {
        console.error('Auth check or socket init failed:', e);
        localStorage.removeItem('agent_token');
        setAgent(null);
      }
    })();
  }, []);



  const restoreActiveChat = async () => {
    const activeId = localStorage.getItem('agent_active_conversation');
    if (!activeId) return;

    try {
      const convoRes = await api.get(`/api/conversations/${activeId}`);
      setActive(convoRes.data);
      setMessages(convoRes.data.messages || []);
      setViewingHistory(false);

      socketRef.current.emit('joinConversation', activeId);
    } catch (e) {
      // conversation may be ended/deleted
      localStorage.removeItem('agent_active_conversation');
    }
  };


  // ---------------- LOGIN ----------------
  const login = async () => {
    try {
      const res = await axios.post(`${API}/api/agents/login`, {
        username,
        password
      });
      const loggedInAgent = res.data.agent;
      localStorage.setItem('agent_token', res.data.token);
      setAgent(loggedInAgent);
      setOnline(loggedInAgent.online);
      const socket = io(`${SOCKET_URL}/agent`, {
        auth: { token: res.data.token }
      });
      socketRef.current = socket;
      setupSocketListeners(socket, loggedInAgent);

    } catch (err) {
      console.error('Login failed:', err);
      alert('Invalid login');
    }
  };



  // ---------------- LOGOUT ----------------
  const logout = async () => {
    try {
      await api.post('/api/agents/logout');

    } catch { }
    localStorage.removeItem('agent_active_conversation');
    localStorage.removeItem('agent_token');
    socketRef.current?.disconnect();
    setAgent(null);
    setOnline(false);
    setWaiting([]);
    setActive(null);
    setMessages([]);
    setChatHistory([]);
  };


  // ---------------- TOGGLE ONLINE/OFFLINE ----------------
  const toggleStatus = async () => {
    const newStatus = !online;
    setOnline(newStatus);

    await api.post(`/api/agents/${agent._id}/status`, {
      status: newStatus
    });
  };

  // ---------------- LOAD WAITING + HISTORY ----------------
  useEffect(() => {
    if (!agent) return;

    const loadHistory = async () => {
      try {
        const res = await api.get(
          `/api/agents/${agent._id}/history`
        );
        setChatHistory(res.data);
      } catch { }
    };
    loadHistory();

    // if(agent.acceptChat && agent.online && agent.status == 'active'){ 
    const loadWaiting = async () => {
      try {
        const res = await api.get(
          `/api/agents/${agent._id}/${agent.companyId}/waiting`
        );
        setWaiting(res.data);
      } catch { }
    };

    loadWaiting();

    const i = setInterval(loadWaiting, 3000);
    return () => clearInterval(i);
    // }
  }, [agent]);


  const openHistoryChat = (chat) => {
    console.log(chat);
    setActive(chat);
    setMessages(chat.messages || []);
    setViewingHistory(true);
    setIsSidebarOpen(false); // Close sidebar on mobile
  };

  // ---------------- ACCEPT CHAT ----------------
  const acceptChat = async () => {
    const res = await api.post(
      `/api/agents/${agent._id}/accept/${showAccept}`
    );

    setActive(res.data);
    setMessages(res.data.messages || []);
    setViewingHistory(false);
    localStorage.setItem('agent_active_conversation', res.data._id);
    socketRef.current.emit('joinConversation', res.data._id);
    setShowAccept(null);
    setIsSidebarOpen(false); // Close sidebar on mobile
  };

  // ---------------- REJECT CHAT ----------------
  const rejectChat = async () => {
    await api.post(
      `/api/agents/${agent._id}/reject/${showAccept}`
    );
    setShowAccept(null);
  };
  // ---------------- AUDIO CALL signaling ----------------
  // ---------------- AUDIO CALL signaling ----------------
  const agentCleanupCall = () => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    clearInterval(callTimerRef.current);
    callTimerRef.current = null;
    setCallState('idle');
    setCallDuration(0);
    setIsMuted(false);
    setCallConversationId(null);
  };

  const agentHangUp = () => {
    socketRef.current.emit('endAudioCall', { conversationId: callConversationId });
    agentCleanupCall();
  };

  const agentToggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsMuted(m => !m);
    }
  };

  const formatDuration = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const acceptAudioCall = () => {
    if (!audioCallRequest) return;
    console.log('🖱️ Accept clicked for convo:', audioCallRequest);
    // Join the conversation room so WebRTC signaling events are routed correctly
    socketRef.current.emit('joinConversation', audioCallRequest);

    // Give a tiny delay to ensure socket.join is processed on server
    setTimeout(() => {
      console.log('📤 Sending acceptAudioCall for convo:', audioCallRequest);
      socketRef.current.emit('acceptAudioCall', { conversationId: audioCallRequest });
      setAudioCallRequest(null);
    }, 100);
  };


  const rejectAudioCall = () => {
    if (!audioCallRequest) return;
    socketRef.current.emit('rejectAudioCall', { conversationId: audioCallRequest });
    setAudioCallRequest(null);
  };

  // ---------------- SEND ----------------
  const sendMessage = () => {
    if (!text.trim() || !active) return;

    socketRef.current.emit('agentMessage', {
      conversationId: active._id,
      text
    });
    setText('');
  };

  // ---------------- END CHAT ----------------
  const endChat = async () => {
    await api.post(`/api/chat/end`, {
      conversationId: active._id,
      endedBy: 'agent'
    });
    localStorage.removeItem('agent_active_conversation');
    setActive(null);
    setMessages([]);
  };

  // ================= LOGIN UI =================
  if (!agent) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h2 className="login-title">Agent Login</h2>
          <p className="login-subtitle">
            Sign in to manage live chats
          </p>

          <input
            className="login-input"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />

          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <button className="login-button" onClick={login}>
            Login
          </button>
        </div>
      </div>
    );
  }

  // ================= DASHBOARD =================
  return (
    <div className="dashboard">
      {/* Mobile Nav */}
      <div className="mobile-nav">
        <button className="mobile-nav-btn" onClick={() => setIsSidebarOpen(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <span style={{ fontWeight: 800 }}>FynChat Agent</span>
        <button className="mobile-nav-btn" onClick={logout}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>

      {/* Sidebar Overlay */}
      <div className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)} />

      {/* Remote audio for WebRTC */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* In-call floating bar */}
      {callState === 'in-call' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(90deg, #1d4ed8, #2563eb)',
          color: 'white', padding: '10px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontWeight: 700, fontSize: '14px' }}>🎙️ Live Audio Call · {formatDuration(callDuration)}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={agentToggleMute} style={{
              background: isMuted ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
              border: 'none', borderRadius: '20px', padding: '6px 14px', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600
            }}>
              {isMuted ? '🔇 Unmute' : '🎙️ Mute'}
            </button>
            <button onClick={agentHangUp} style={{
              background: '#ef4444', border: 'none', borderRadius: '20px',
              padding: '6px 14px', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 700
            }}>
              📵 End Call
            </button>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L22 4l-2.1 4.7a8.38 8.38 0 0 1 .9 3.8z"></path>
          </svg>
          <span>FynChat</span>
        </div>

        <div className="agent-profile">
          <div className="agent-avatar">
            {agent.username?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="agent-info">
            <div className="agent-name">{agent.username || 'Agent'}</div>
            <div className="agent-status-label">
              <span className={`status-indicator ${online ? 'online' : 'offline'}`} />
              {online ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>

        <div className="sidebar-actions">
          <div className="status-toggle-container">
            <button
              className={`status-pill ${online ? 'online' : 'offline'}`}
              onClick={toggleStatus}
            >
              <span className="status-pill-dot" />
              {online ? 'Go Offline' : 'Go Online'}
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <h4 className="section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Waiting Chats
          </h4>
          <div className="chat-list">
            {waiting.map(c => (
              <div key={c._id} className="sidebar-chat-card waiting" onClick={() => setShowAccept(c._id)}>
                <div className="card-icon">!</div>
                <div className="card-content">
                  <div className="card-title">{c.guestName || 'Visitor'}</div>
                  <div className="card-subtitle">{c.guestEmail || 'Click to Accept'}</div>
                </div>
              </div>
            ))}
            {waiting.length === 0 && <div className="empty-section">No waiting chats</div>}
          </div>
        </div>

        <div className="sidebar-section">
          <h4 className="section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Chat History
          </h4>
          <div className="chat-list">
            {chatHistory.map(c => (
              <div key={c._id} className="sidebar-chat-card history" onClick={() => openHistoryChat(c)}>
                <div className="card-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </div>
                <div className="card-content">
                  <div className="card-title">{new Date(c.endedAt).toLocaleDateString()}</div>
                  <div className="card-subtitle">{formatTime(new Date(c.endedAt))} · {c.endedBy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* CHAT WINDOW */}
      <main className="chat-window">
        <header className="chat-header">
          <div className="header-info">
            {active ? (
              <>
                <h3>{viewingHistory ? 'Conversation History' : (active?.guestName ? `Live with ${active.guestName}` : 'Live Session')}</h3>
                <div className="header-status">
                  <span className="status-indicator online"></span>
                  Active
                </div>
              </>
            ) : (
              <h3>Agent Dashboard</h3>
            )}
          </div>

          <div className="header-actions">
            <button onClick={logout} className="logout-button-alt header-logout">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </header>

        {!active && callState !== 'in-call' && (
          <div className="empty">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h3>Ready to Connect</h3>
            <p>Select a waiting chat or view history to get started.</p>
          </div>
        )}

        {!active && callState === 'in-call' && (
          <div className="empty" style={{ background: '#f8fafc' }}>
            <div style={{
              width: 120, height: 120, borderRadius: '50%', background: '#4ade80',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 20px rgba(74, 222, 128, 0.2)',
              animation: 'pulse 2s infinite', marginBottom: 32
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
              </svg>
            </div>
            <h2 style={{ fontSize: '32px', color: '#1e293b', marginBottom: 8 }}>Live Audio Call</h2>
            <p style={{ fontSize: '20px', color: '#64748b', marginBottom: 32, fontWeight: 500 }}>
              Duration: {formatDuration(callDuration)}
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
              <button onClick={agentToggleMute} style={{
                background: isMuted ? '#cbd5e1' : '#e2e8f0', color: '#334155', border: 'none',
                borderRadius: '30px', padding: '12px 24px', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                {isMuted ? '🔇 Unmute' : '🎙️ Mute'}
              </button>
              <button onClick={agentHangUp} style={{
                background: '#ef4444', color: 'white', border: 'none',
                borderRadius: '30px', padding: '12px 24px', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                📵 End Call
              </button>
            </div>
          </div>
        )}

        {active && (
          <>
            <div className="chat-messages">
              {(() => {
                let lastDayKey = null;

                return messages.map((m, i) => {
                  const ts = getMsgTs(m);
                  const dayKey = ts.toDateString();
                  const showDay = dayKey !== lastDayKey;
                  lastDayKey = dayKey;

                  const isAgent = m.from === 'agent';

                  return (
                    <div key={i} className={`message-wrapper ${isAgent ? 'right' : 'left'}`}>
                      {showDay && (
                        <div className="chat-day-separator">
                          {formatDayLabel(ts)}
                        </div>
                      )}

                      <div
                        className="chat-row"
                        style={{
                          display: 'flex',
                          justifyContent: isAgent ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <div className={`bubble ${m.from}`}>
                          {isAgent && m.agentName && (
                            <div className="chat-bubble-name" style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', opacity: 0.8 }}>
                              {m.agentName}
                            </div>
                          )}
                          <div className="chat-bubble-text">{m.text}</div>
                          <div className="chat-bubble-time">{formatTime(ts)}</div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            {!viewingHistory && (
              <div className="chat-input">
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message…"
                />
                <button onClick={sendMessage} className="btn-send">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                  Send
                </button>
                <button onClick={endChat} className="btn-end">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                  End Chat
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ACCEPT MODAL */}
      {showAccept && (
        <div className="modal">
          <div className="modal-box">
            <div className="modal-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L22 4l-2.1 4.7a8.38 8.38 0 0 1 .9 3.8z"></path>
              </svg>
            </div>
            <h3>Accept Chat Request?</h3>
            <p>A new customer is waiting to connect. Would you like to start this conversation now?</p>
            <div className="modal-actions">
              <button className="btn-accept" onClick={acceptChat}>Accept</button>
              <button className="btn-reject" onClick={rejectChat}>Reject</button>
              <button className="btn-cancel" onClick={() => setShowAccept(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* AUDIO CALL MODAL */}
      {audioCallRequest && (
        <div className="modal">
          <div className="modal-box" style={{ borderTop: '4px solid #6366f1' }}>
            <div className="modal-icon" style={{ background: '#e0e7ff', color: '#6366f1' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </div>
            <h3>Incoming Audio Call</h3>
            <p>A customer is requesting an audio conversation. Would you like to accept?</p>
            <div className="modal-actions">
              <button className="btn-accept" style={{ background: '#6366f1' }} onClick={acceptAudioCall}>Accept Call</button>
              <button className="btn-reject" onClick={rejectAudioCall}>Decline</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}