import { useState, useEffect } from "react";
import { MessageSquare } from 'lucide-react';
import api from '../utils/api';
import './ChatHistory.css';

export default function ChatHistory({ user }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await api.get('/api/chats');
        setChats(response.data);
        if (response.data.length > 0) {
          setSelectedChat(response.data[0]);
        }
      } catch (err) {
        console.error("Fetch Chats Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchChats();
  }, []);

  const filteredChats = chats.filter((c) =>
    filter === "all" ? true : c.status === filter
  );

  if (loading) return <div className="p-6">Loading Chat History...</div>;

  return (
    <div className="chat-history">
      <div className="history-header">
        <h1>Chat History</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select onChange={(e) => setFilter(e.target.value)} className="history-filter">
            <option value="all">All Status</option>
            <option value="bot">Chatbot</option>
            <option value="live">Live Agent</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="history-body">
        {/* Left Panel: List of Conversations */}
        <div className="chat-list">
          {filteredChats.length > 0 ? filteredChats.map((chat) => (
            <div
              key={chat._id}
              className={`chat-item ${selectedChat?._id === chat._id ? "active" : ""
                }`}
              onClick={() => setSelectedChat(chat)}
            >
              <div className="chat-item-header">
                <strong>{chat.guestName || 'Visitor'}</strong>
                <span className={`status-pill ${chat.status}`}>
                  {chat.status}
                </span>
              </div>
              <p className="last-msg">
                {chat.messages[chat.messages.length - 1]?.text || 'No messages'}
              </p>
              <small className="chat-date">
                {new Date(chat.createdAt).toLocaleDateString()} {new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </small>
            </div>
          )) : (
            <div className="empty-history-msg">No conversations found.</div>
          )}
        </div>

        {/* Right Panel: Message View */}
        <div className="chat-view">
          {selectedChat ? (
            <>
              <div className="chat-header">
                <div>
                  <h3>Session: {selectedChat._id.substring(selectedChat._id.length - 6)}</h3>
                  <p className="chat-meta">
                    {selectedChat.agentId ? `Handled by: ${selectedChat.agentId.username}` : 'Handled by Bot'}
                  </p>
                </div>
                <span className="chat-id-tag">ID: {selectedChat._id}</span>
              </div>

              <div className="chat-messages">
                {selectedChat.messages.map((msg, i) => (
                  <div key={i} className={`msg ${msg.from}`}>
                    <div className="msg-sender">
                      {msg.from === 'agent' ? (msg.agentName || 'Agent') :
                        msg.from === 'user' ? (selectedChat.guestName || 'User') :
                          'FineChat'}
                    </div>
                    <div className="msg-bubble">
                      <span>{msg.text}</span>
                      <small>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="select-chat-prompt">
              <MessageSquare size={48} opacity={0.2} />
              <p>Select a conversation to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
