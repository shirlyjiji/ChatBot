import React from 'react';
import { Mic, MicOff, PhoneOff } from 'lucide-react';

const InCallView = ({ callDuration, isMuted, toggleMute, agentCleanupCall, agentName }) => {
    const formatDuration = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    return (
        <div className="incall-container">
            <div className="mesh-gradient-bg"></div>

            <div className="incall-content">
                <div className="call-status">
                    <div className="status-dot-pulse"></div>
                    <span>Audio Call Connected</span>
                </div>

                <div className="avatar-section">
                    <div className="pulse-ring"></div>
                    <div className="pulse-ring delay-1"></div>
                    <div className="pulse-ring delay-2"></div>
                    <div className="main-avatar">
                        {agentName ? agentName.charAt(0).toUpperCase() : 'U'}
                    </div>
                </div>

                {/* Simple Audio Visualizer bars */}
                <div className="audio-visualizer">
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                </div>


                <div className="timer-section">
                    <h2 className="call-timer">{formatDuration(callDuration)}</h2>
                    <p className="call-participant">Customer Conversation</p>
                </div>

                <div className="call-controls-bar">
                    <button
                        className={`control-btn ${isMuted ? 'muted' : ''}`}
                        onClick={toggleMute}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                        <span>{isMuted ? 'Unmuted' : 'Mute'}</span>
                    </button>

                    <button
                        className="control-btn hangup"
                        onClick={agentCleanupCall}
                        title="End Call"
                    >
                        <PhoneOff size={20} />
                        <span>End Call</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InCallView;
