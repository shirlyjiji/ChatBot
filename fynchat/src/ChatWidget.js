import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

import './App.css';
import { getMsgTs, formatTime, formatDayLabel } from './utils/chatTime';

export default function ChatWidget({ apiKey: propKey }) {
  const API = process.env.REACT_APP_API_BASE_URL;
  const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;
  console.log('ChatWidget: window.location.href =', window.location.href);
  const apiKey =
    propKey ||
    new URLSearchParams(window.location.search).get('apiKey') ||
    window.name ||
    localStorage.getItem('fynchat_api_key');
  console.log('ChatWidget: final apiKey =', apiKey);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketBoundRef = useRef(false);
  const peerRef = useRef(null);       // RTCPeerConnection
  const localStreamRef = useRef(null); // local microphone stream
  const remoteAudioRef = useRef(null); // remote audio element


  const [conversationId, setConversationId] = useState(null);
  const conversationIdRef = useRef(null);
  const [currentNode, setCurrentNode] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const [input, setInput] = useState('');
  const [errorHeader, setErrorHeader] = useState('');
  const [hideOptions, setHideOptions] = useState(false);

  // Appointment
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);

  // Agent / lifecycle
  const [agentMode, setAgentMode] = useState(false);
  const [chatEnded, setChatEnded] = useState(false);
  const [showBackToMenu, setShowBackToMenu] = useState(false);

  // Audio call state
  const [callState, setCallState] = useState('idle'); // idle | calling | in-call
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef(null);


  // ---------------- INIT SOCKET (ONCE) ----------------
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('chatEnded', () => {
      setAgentMode(false);
      setChatEnded(true);
    });

    socketRef.current.on('audioCallAccepted', async () => {
      setCallState('in-call');
      setMessages(prev => [...prev, { from: 'bot', text: '📞 Audio call connected! You are now speaking with an agent.' }]);
      // Start call timer
      let sec = 0;
      callTimerRef.current = setInterval(() => { sec++; setCallDuration(sec); }, 1000);
      // Start WebRTC as initiator: create offer
      initWebRTCUser(conversationIdRef.current);
    });

    socketRef.current.on('audioCallRejected', () => {
      setCallState('idle');
      setMessages(prev => [...prev, { from: 'bot', text: 'Agent is unable to take an audio call at the moment.' }]);
    });

    socketRef.current.on('webrtc-answer', async ({ answer }) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socketRef.current.on('webrtc-ice-candidate', async ({ candidate }) => {
      if (peerRef.current && candidate) {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socketRef.current.on('audioCallEnded', () => {
      cleanupCall();
    });

    return () => {
      socketRef.current.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAuthenticated = true;
  const guestName = 'Guest';
  const guestEmail = '';
  // ---------------- AUTO START CHAT ----------------
  useEffect(() => {
    if (isAuthenticated && !conversationId) {
      const currentKey = propKey || new URLSearchParams(window.location.search).get('apiKey') || window.name || localStorage.getItem('fynchat_api_key');
      if (currentKey) {
        start(currentKey);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, conversationId, propKey]);




  //appoinment slots
  useEffect(() => {
    if (!selectedDate || currentNode?.type !== 'appointmentNode') return;

    const loadSlots = async () => {
      const res = await axios.get(
        `${API}/api/appointments/slots`,
        {
          params: {
            conversationId,
            date: selectedDate
          }
        }
      );

      const allSlots = generateSlots(
        currentNode.data.startTime || '09:00',
        currentNode.data.endTime || '17:00',
        Number(currentNode.data.slotDuration) || 30
      );

      setAvailableSlots(allSlots.filter(s => !res.data.includes(s)));
    };

    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, currentNode, conversationId]);


  // ---------------- START CHAT ----------------
  const start = async (overrideKey) => {
    const keyToUse = overrideKey || apiKey;
    console.log('ChatWidget: start() called with keyToUse =', keyToUse);
    try {
      const res = await axios.post(
        `${API}/api/chat/start`,
        { guestName, guestEmail },
        { headers: { 'x-api-key': keyToUse } }
      );

      setConversationId(res.data.conversationId);
      conversationIdRef.current = res.data.conversationId;
      setCurrentNode(res.data.currentNode);

      const msgs = [{ from: 'bot', text: res.data.startMessage }];

      if (res.data.currentNode) {
        msgs.push({
          from: 'bot',
          text:
            res.data.currentNode.type === 'optionNode'
              ? res.data.currentNode.data.question
              : res.data.currentNode.data.label
        });
      }

      setMessages(msgs);
      // Don't auto-open — let the trigger button handle visibility
    } catch (err) {
      console.error('ChatWidget start error hitting', `${API}/api/chat/start`, ':', err.response?.data || err.message);
      // Fallback message if needed
    }
  };

  // ---------------- BIND SOCKET (AGENT MODE) ----------------
  const bindSocketOnce = () => {
    if (socketBoundRef.current) return;
    socketBoundRef.current = true;

    socketRef.current.on('message', msg => {
      setMessages(prev => [...prev, msg]);
    });

    socketRef.current.on('chatRejected', data => {
      setAgentMode(false);
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: data.message || 'Request not accepted. Returning to bot...' }
      ]);
      setShowBackToMenu(true);
    });
  };

  // ---------------- SEND BOT TEXT ----------------
  const sendText = async () => {
    if (!input.trim()) return;

    if (!agentMode && currentNode?.type === 'inputNode') {
      const validationType = currentNode?.data?.validationType || 'text';

      if (validationType === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input)) {
          setErrorHeader("Please enter a valid email address.");
          setTimeout(() => setErrorHeader(''), 3000);
          return;
        }
      }

      if (validationType === 'number') {
        const numberRegex = /^[0-9+\-\s()]+$/;
        if (!numberRegex.test(input)) {
          setErrorHeader("Please enter a valid number or phone.");
          setTimeout(() => setErrorHeader(''), 3000);
          return;
        }
      }
    }

    setMessages(prev => [...prev, { from: 'user', text: input }]);

    const res = await axios.post(`${API}/api/chat/next`, {
      conversationId,
      userInput: { text: input }
    });

    if (res.data.repeat) {
      setInput('');
      return;
    }

    if (res.data.noAgent) {
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: res.data.message }
      ]);
      setShowBackToMenu(true);
      setInput('');
      return;
    }

    if (res.data.agent) {
      setAgentMode(true);
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: 'Connecting you to an agent...' }
      ]);

      socketRef.current.emit('joinConversation', res.data.conversationId);
      bindSocketOnce();
      setInput('');
      return;
    }

    if (res.data.end) {
      if (res.data.messages) {
        setMessages(prev => [...prev, ...res.data.messages.map(m => ({ from: 'bot', text: m.text }))]);
      }
      setShowBackToMenu(true);
      setInput('');
      return;
    }

    if (res.data.messages) {
      setMessages(prev => [...prev, ...res.data.messages.map(m => ({ from: 'bot', text: m.text }))]);
      setCurrentNode(res.data.node);
    } else if (res.data.node) {
      setMessages(prev => [
        ...prev,
        {
          from: 'bot',
          text:
            res.data.node.type === 'optionNode'
              ? res.data.node.data.question
              : res.data.node.data.label
        }
      ]);
      setCurrentNode(res.data.node);
    }

    setInput('');
  };

  // ---------------- OPTION CLICK ----------------
  const selectOption = async (opt, index) => {
    setHideOptions(true);
    setMessages(prev => [...prev, { from: 'user', text: opt }]);

    const res = await axios.post(`${API}/api/chat/next`, {
      conversationId,
      userInput: { optionIndex: index, text: opt }
    });

    if (res.data.noAgent) {
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: res.data.message }
      ]);
      setShowBackToMenu(true);
      return;
    }

    if (res.data.agent) {
      setAgentMode(true);
      if (res.data.messages) {
        setMessages(prev => [...prev, ...res.data.messages.map(m => ({ from: 'bot', text: m.text }))]);
      } else {
        setMessages(prev => [
          ...prev,
          { from: 'bot', text: 'Connecting you to an agent...' }
        ]);
      }
      socketRef.current.emit('joinConversation', res.data.conversationId);
      bindSocketOnce();
      return;
    }

    if (res.data.end) {
      if (res.data.messages) {
        setMessages(prev => [...prev, ...res.data.messages.map(m => ({ from: 'bot', text: m.text }))]);
      }
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: res.data.message || 'Thank you! Let us know if you need anything else.' }
      ]);
      setShowBackToMenu(true);
      return;
    }

    if (res.data.messages) {
      setMessages(prev => [...prev, ...res.data.messages.map(m => ({ from: 'bot', text: m.text }))]);
      setCurrentNode(res.data.node);
      setHideOptions(false);
    } else if (res.data.node) {
      setMessages(prev => [
        ...prev,
        {
          from: 'bot',
          text:
            res.data.node.type === 'optionNode'
              ? res.data.node.data.question
              : res.data.node.data.label
        }
      ]);
      setCurrentNode(res.data.node);
      setHideOptions(false);
    }
  };


  const generateSlots = (start, end, duration) => {
    if (!start || !end || !duration) return [];

    const slots = [];
    let [h, m] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);

    while (h < eh || (h === eh && m < em)) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      m += duration;
      if (m >= 60) {
        h++;
        m -= 60;
      }
    }
    return slots;
  };

  const bookSlot = async (time) => {
    setMessages(prev => [
      ...prev,
      { from: 'user', text: `${selectedDate} ${time}` }
    ]);

    const res = await axios.post(`${API}/api/chat/next`, {
      conversationId,
      userInput: {
        appointment: {
          date: selectedDate,
          time
        }
      }
    });

    if (res.data.messages) {
      setMessages(prev => [...prev, ...res.data.messages.map(m => ({ from: 'bot', text: m.text }))]);
      setCurrentNode(res.data.node);
    } else if (res.data.node) {
      setMessages(prev => [
        ...prev,
        {
          from: 'bot',
          text:
            res.data.node.type === 'optionNode'
              ? res.data.node.data.question
              : res.data.node.data.label
        }
      ]);
      setCurrentNode(res.data.node);
    } else if (res.data.end) {
      if (res.data.messages) {
        setMessages(prev => [...prev, ...res.data.messages.map(m => ({ from: 'bot', text: m.text }))]);
      }
      setCurrentNode(null);
      setShowBackToMenu(true);
    } else {
      // Clear current node if no next node is provided
      setCurrentNode(null);
    }

    setSelectedDate('');
    setAvailableSlots([]);
  };


  // ---------------- LIVE AGENT SEND ----------------
  const sendLive = () => {
    if (!input.trim()) return;

    socketRef.current.emit('userMessage', {
      conversationId,
      text: input
    });

    setInput('');
  };

  // ---------------- REQUEST LIVE AGENT ----------------
  const requestLiveAgent = async () => {
    if (chatEnded || agentMode || !conversationId) return;

    // Add user message to UI
    setMessages(prev => [...prev, { from: 'user', text: 'Connect me to an agent' }]);

    try {
      const res = await axios.post(`${API}/api/chat/request-agent`, {
        conversationId
      });

      if (res.data.noAgent) {
        setMessages(prev => [
          ...prev,
          { from: 'bot', text: res.data.message || 'No agents are available' }
        ]);
        setShowBackToMenu(true);
        return;
      }

      if (res.data.agent) {
        setAgentMode(true);
        setMessages(prev => [
          ...prev,
          { from: 'bot', text: 'Connecting you to an agent...' }
        ]);
        socketRef.current.emit('joinConversation', res.data.conversationId);
        bindSocketOnce();
      }
    } catch (err) {
      console.error('requestLiveAgent error:', err);
      setMessages(prev => [
        ...prev,
        { from: 'bot', text: 'No agents are available' }
      ]);
      setShowBackToMenu(true);
    }
  };

  // ---------------- WEBRTC HELPERS ----------------
  const createPeerConnection = (cid) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit('webrtc-ice-candidate', {
          conversationId: cid,
          candidate: e.candidate
        });
      }
    };

    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
      }
    };

    return pc;
  };

  const initWebRTCUser = async (cid) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = createPeerConnection(cid);
      peerRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit('webrtc-offer', { conversationId: cid, offer });
    } catch (err) {
      console.error('getUserMedia/offer error:', err);
      setMessages(prev => [...prev, { from: 'bot', text: 'Microphone access denied. Cannot start audio call.' }]);
      cleanupCall();
    }
  };

  const cleanupCall = () => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    clearInterval(callTimerRef.current);
    callTimerRef.current = null;
    setCallState('idle');
    setCallDuration(0);
    setIsMuted(false);
  };

  // ---------------- REQUEST AUDIO CALL ----------------
  const requestAudioCall = () => {
    if (chatEnded || !conversationId) return;
    if (callState !== 'idle') return;
    setCallState('calling');
    setMessages(prev => [...prev, { from: 'bot', text: '📞 Calling... Waiting for agent to accept.' }]);
    // Only emit the audio call request — do NOT trigger live chat queue
    socketRef.current.emit('requestAudioCall', { conversationId });
  };

  const hangUpCall = () => {
    socketRef.current.emit('endAudioCall', { conversationId });
    cleanupCall();
    setMessages(prev => [...prev, { from: 'bot', text: 'Audio call ended.' }]);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsMuted(m => !m);
    }
  };

  // ---------------- RESTART CHAT (BACK TO MENU) ----------------
  const restartChat = async () => {
    try {
      const res = await axios.post(`${API}/api/chat/restart`, {
        conversationId
      });

      if (res.data.success) {
        setMessages(prev => [...prev, { from: 'bot', text: res.data.message || 'Back to menu' }]);
        setCurrentNode(res.data.currentNode);
        setShowBackToMenu(false);
        setHideOptions(false);
        setAgentMode(false);
        setChatEnded(false);
        setSelectedDate('');
        setAvailableSlots([]);
      }
    } catch (err) {
      console.error('restartChat error:', err);
    }
  };

  // ---------------- END CHAT ----------------
  const endChat = async () => {
    await axios.post(`${API}/api/chat/end`, {
      conversationId,
      endedBy: 'user'
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      if (chatEnded) return;

      if (agentMode) {
        sendLive();
      } else {
        sendText();
      }
    }
  };


  // Format call duration as MM:SS
  const formatDuration = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="chat-widget">
      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* In-call floating overlay */}
      {(callState === 'in-call' || callState === 'calling') && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
          background: callState === 'in-call' ? 'linear-gradient(135deg, #1d4ed8, #2563eb)' : 'linear-gradient(135deg, #374151, #1f2937)',
          color: 'white', padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderRadius: '20px 20px 0 0', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: callState === 'in-call' ? '#4ade80' : '#fbbf24',
              animation: 'pulse 1.5s infinite'
            }} />
            <span style={{ fontSize: '13px', fontWeight: '600' }}>
              {callState === 'calling' ? 'Calling...' : `On Call · ${formatDuration(callDuration)}`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {callState === 'in-call' && (
              <button onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'} style={{
                background: isMuted ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
                border: 'none', borderRadius: '50%', width: 32, height: 32,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
              }}>
                {isMuted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                )}
              </button>
            )}
            {callState === 'calling' ? (
              <button onClick={hangUpCall} style={{
                background: '#ef4444', color: 'white', border: 'none',
                borderRadius: '16px', padding: '6px 12px', fontSize: '13px',
                fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center'
              }}>
                Cancel
              </button>
            ) : (
              <button onClick={hangUpCall} title="Hang up" style={{
                background: '#ef4444', border: 'none', borderRadius: '50%',
                width: 32, height: 32, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )
      }

      {/* Intercom-style Close Bar Header */}
      <div className="chat-header">
        <div className="chat-header-center">
          <div className="chat-header-info">
            <h2>FynChat</h2>
            <p>The team can also help</p>
          </div>
        </div>
        <div className="chat-header-actions">
          {!chatEnded && !agentMode && (
            <button className="chat-header-btn" onClick={requestLiveAgent} title="Connect to an Agent">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
              </svg>
            </button>
          )}
          {!chatEnded && (
            <button className="chat-header-btn" onClick={requestAudioCall} title="Audio Call">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </button>
          )}
          <button className="chat-header-btn" onClick={() => window.parent.postMessage('closeFynChat', '*')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {(() => {
          let lastDayKey = null;

          return messages.map((m, i) => {
            const ts = getMsgTs(m);
            const dayKey = ts.toDateString();
            const showDay = dayKey !== lastDayKey;
            lastDayKey = dayKey;

            return (
              <div key={i}>
                {showDay && (
                  <div className="chat-day-separator">
                    {formatDayLabel(ts)}
                  </div>
                )}

                <div className={`chat-row ${m.from === 'user' ? 'right' : 'left'}`}>
                  <div className={`chat-bubble ${m.from}`}>
                    {m.from === 'agent' && m.agentName && (
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

        {!hideOptions && callState === 'idle' &&
          currentNode?.type === 'optionNode' &&
          currentNode.data.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => selectOption(opt, i)}
              className="chat-option-btn"
            >
              {opt}
            </button>
          ))}

        {callState === 'idle' && currentNode?.type === 'appointmentNode' && (
          <div className="chat-appointment-container">

            <label>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: 'text-bottom' }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Select date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="chat-date-input"
            />

            {availableSlots.length > 0 && (
              <div className="chat-slots-grid">
                {availableSlots.map((slot, i) => (
                  <button
                    key={i}
                    onClick={() => bookSlot(slot)}
                    className="chat-slot-btn"
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {showBackToMenu && (
          <button
            onClick={restartChat}
            className="chat-option-btn restart-btn"
            style={{
              marginTop: '12px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
              fontWeight: '600'
            }}
          >
            Back to Menu
          </button>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="chat-input-row" style={{ position: 'relative' }}>
        {errorHeader && (
          <div className="error-toast" style={{
            position: 'absolute',
            top: '-50px',
            left: '20px',
            right: '20px',
            background: '#fff1f2',
            color: '#e11d48',
            padding: '8px 16px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '700',
            border: '1px solid #fda4af',
            boxShadow: '0 4px 12px rgba(225, 29, 72, 0.1)',
            animation: 'toastFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            zIndex: 10
          }}>
            {errorHeader}
          </div>
        )}
        <div className="chat-input-container">
          <input
            className="chat-text-input"
            value={input}
            onChange={e => {
              setInput(e.target.value);
              if (errorHeader) setErrorHeader('');
            }}
            onKeyDown={handleKeyDown}
            placeholder={agentMode ? 'Chat with agent...' : 'Enter your message...'}
          />
          <button
            className="chat-send-btn"
            onClick={agentMode ? sendLive : sendText}
            disabled={!input.trim()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>


      {
        (agentMode || chatEnded) && (
          <div className="chat-footer-actions">
            {agentMode && (
              <button className="chat-end-btn" onClick={endChat}>
                End Conversation
              </button>
            )}
            {chatEnded && (
              <button className="chat-restart-btn" onClick={() => window.location.reload()}>
                Start New Chat
              </button>
            )}
          </div>
        )
      }
    </div >
  );
}
