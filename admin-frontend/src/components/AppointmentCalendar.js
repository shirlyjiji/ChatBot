import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { X, Calendar, Clock, Hash } from 'lucide-react';
import api from '../utils/api';
import './Appointments.css';

const Appointments = ({ user }) => {
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const endpoint = user.companyId
                    ? `/api/appointments/all/${user.companyId}`
                    : `/api/appointments/all`;
                const res = await api.get(endpoint);
                const formatted = res.data.map(appt => ({
                    id: appt._id,
                    title: `${appt.time} - Booked`,
                    start: `${appt.date}T${appt.time}:00`,
                    end: `${appt.date}T${appt.time.split(':')[0]}:${parseInt(appt.time.split(':')[1]) + 30}:00`,
                    extendedProps: {
                        conversationId: appt.conversationId,
                        date: appt.date,
                        time: appt.time,
                        bookedAt: new Date(appt.createdAt).toLocaleString()
                    }
                }));
                setEvents(formatted);
            } catch (err) {
                console.error("Error loading appointments", err);
            }
        };
        if (user) fetchAppointments();
    }, [user]);

    const handleEventClick = (info) => {
        setSelectedEvent(info.event);
        setIsModalOpen(true);
    };

    // Compute stats
    const today = new Date().toISOString().split('T')[0];
    const todayCount = events.filter(e => e.extendedProps.date === today).length;
    const futureCount = events.filter(e => e.extendedProps.date >= today).length;
    const totalCount = events.length;

    return (
        <div className="calendar-page-container">

            {/* ── Gradient Header ── */}
            <div className="calendar-header-section">
                <div>
                    <h1 className="view-title">Appointment Schedule</h1>
                    <p className="view-subtitle">Monitor and manage your daily bookings</p>
                </div>
            </div>

            {/* ── Stats Row ── */}
            <div className="calendar-stats-row">
                <div className="stat-card">
                    <div className="stat-icon purple">📅</div>
                    <div className="stat-info">
                        <div className="stat-label">Total Bookings</div>
                        <div className="stat-value">{totalCount}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon blue">🔮</div>
                    <div className="stat-info">
                        <div className="stat-label">Upcoming</div>
                        <div className="stat-value">{futureCount}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green">✅</div>
                    <div className="stat-info">
                        <div className="stat-label">Today</div>
                        <div className="stat-value">{todayCount}</div>
                    </div>
                </div>
            </div>

            {/* ── Calendar ── */}
            <div className="calendar-card">
                <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay'
                    }}
                    events={events}
                    height="72vh"
                    displayEventTime={false}
                    eventColor="#6366f1"
                    eventTextColor="#ffffff"
                    nowIndicator={true}
                    eventClick={handleEventClick}
                />
            </div>

            {/* ── Modal ── */}
            {isModalOpen && selectedEvent && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Appointment Details</h3>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-item">
                                <Calendar size={18} className="icon" />
                                <div>
                                    <label>Date</label>
                                    <p>{selectedEvent.extendedProps.date}</p>
                                </div>
                            </div>
                            <div className="detail-item">
                                <Clock size={18} className="icon" />
                                <div>
                                    <label>Time Slot</label>
                                    <p>{selectedEvent.extendedProps.time}</p>
                                </div>
                            </div>
                            <div className="detail-item">
                                <Hash size={18} className="icon" />
                                <div>
                                    <label>Conversation ID</label>
                                    <p className="id-text">{selectedEvent.extendedProps.conversationId}</p>
                                </div>
                            </div>
                            <div className="detail-item info">
                                <small>Booked on: {selectedEvent.extendedProps.bookedAt}</small>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="primary-btn" onClick={() => setIsModalOpen(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Appointments;