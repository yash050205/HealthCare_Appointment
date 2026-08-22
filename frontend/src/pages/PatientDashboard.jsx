import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await api.get('/appointments/mine');
    setAppointments(data.appointments);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function cancel(id) {
    if (!confirm('Cancel this appointment?')) return;
    await api.post(`/appointments/${id}/cancel`, { reason: 'Cancelled by patient' });
    load();
  }

  async function connectCalendar() {
    const { data } = await api.get('/calendar/oauth/connect');
    window.location.href = data.url;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Your appointments</h1>
        <div className="header-actions">
          <button className="btn-ghost" onClick={connectCalendar}>Connect Google Calendar</button>
          <Link to="/patient/find-doctors" className="btn-primary-sm">Book new appointment</Link>
        </div>
      </div>

      {loading ? <p>Loading…</p> : appointments.length === 0 ? (
        <p className="empty-state">No appointments yet. Find a doctor to get started.</p>
      ) : (
        <div className="card-list">
          {appointments.map((a) => (
            <div key={a.id} className={`card status-${a.status}`}>
              <div className="card-row">
                <strong>Dr. {a.doctor?.User?.name}</strong>
                <span className={`badge badge-${a.status}`}>{a.status}</span>
              </div>
              <p>{a.appointment_date} at {a.start_time}</p>
              {a.pre_visit_summary && (
                <p className="muted">Urgency: {a.pre_visit_summary.urgency_level}</p>
              )}
              {a.post_visit_summary && (
                <details>
                  <summary>Post-visit summary</summary>
                  <p>{a.post_visit_summary}</p>
                </details>
              )}
              {a.status === 'booked' && (
                <button className="btn-ghost-danger" onClick={() => cancel(a.id)}>Cancel</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
