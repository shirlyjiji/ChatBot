import React from 'react';

const CallEndedView = ({ callDuration, agentName, onDismiss }) => {
    const formatDuration = (s) =>
        `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    return (
        <div className="call-ended-container">
            {/* Soft gradient background */}
            <div className="call-ended-bg" />

            <div className="call-ended-content">
                {/* Check icon */}
                <div className="call-ended-icon-wrap">
                    <div className="call-ended-icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                </div>

                {/* Title */}
                <h2 className="call-ended-title">Call Completed</h2>
                <p className="call-ended-subtitle">The audio conversation has ended successfully.</p>

                {/* Stats card */}
                <div className="call-ended-stats">
                    <div className="call-stat-item">
                        <span className="call-stat-label">Duration</span>
                        <span className="call-stat-value">{formatDuration(callDuration)}</span>
                    </div>
                    <div className="call-stat-divider" />
                    <div className="call-stat-item">
                        <span className="call-stat-label">Agent</span>
                        <span className="call-stat-value">{agentName || 'You'}</span>
                    </div>
                    <div className="call-stat-divider" />
                    <div className="call-stat-item">
                        <span className="call-stat-label">Status</span>
                        <span className="call-stat-value call-stat-success">✓ Completed</span>
                    </div>
                </div>

                {/* Dismiss button */}
                <button className="call-ended-btn" onClick={onDismiss}>
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
};

export default CallEndedView;
