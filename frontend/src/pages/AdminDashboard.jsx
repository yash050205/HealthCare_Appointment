import { useEffect, useState } from 'react';
import api from '../api/client';

const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' }, { key: 'sun', label: 'Sun' },
];

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [tab, setTab] = useState('doctors');

  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', specialization: '', bio: '', slot_duration_minutes: 30,
  });
  const [activeDays, setActiveDays] = useState({ mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false });
  const [hours, setHours] = useState({ start: '09:00', end: '17:00' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [leaveForm, setLeaveForm] = useState({}); // { [doctorId]: { date, reason } }

  async function loadDoctors() {
    const { data } = await api.get('/admin/doctors');
    setDoctors(data.doctors);
  }
  async function loadAppointments() {
    const { data } = await api.get('/admin/appointments');
    setAppointments(data.appointments);
  }

  useEffect(() => { loadDoctors(); loadAppointments(); }, []);

  async function createDoctor(e) {
    e.preventDefault();
    setError(''); setMessage('');
    const working_hours = {};
    Object.entries(activeDays).forEach(([day, active]) => {
      if (active) working_hours[day] = [{ start: hours.start, end: hours.end }];
    });
    try {
      await api.post('/admin/doctors', { ...form, working_hours });
      setMessage('Doctor created successfully.');
      setForm({ name: '', email: '', password: '', phone: '', specialization: '', bio: '', slot_duration_minutes: 30 });
      loadDoctors();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create doctor');
    }
  }

  async function markLeave(doctorId) {
    const info = leaveForm[doctorId];
    if (!info?.date) return;
    await api.post(`/admin/doctors/${doctorId}/leave`, { leave_date: info.date, reason: info.reason });
    setMessage(`Leave recorded for doctor #${doctorId}. Affected patients notified.`);
    loadAppointments();
  }

  return (
    <div>
      <h1>Admin</h1>
      <div className="tabs">
        <button className={tab === 'doctors' ? 'tab active' : 'tab'} onClick={() => setTab('doctors')}>Doctors</button>
        <button className={tab === 'appointments' ? 'tab active' : 'tab'} onClick={() => setTab('appointments')}>All appointments</button>
      </div>

      {message && <p className="success-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}

      {tab === 'doctors' && (
        <>
          <div className="card">
            <h2>Add a doctor</h2>
            <form onSubmit={createDoctor} className="grid-form">
              <input placeholder="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input placeholder="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input placeholder="Temp password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input placeholder="Specialization" required value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
              <input placeholder="Slot duration (min)" type="number" value={form.slot_duration_minutes}
                onChange={(e) => setForm({ ...form, slot_duration_minutes: Number(e.target.value) })} />
              <textarea placeholder="Bio (optional)" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />

              <div>
                <label>Working days</label>
                <div className="day-toggle-row">
                  {DAYS.map((d) => (
                    <label key={d.key} className="day-toggle">
                      <input type="checkbox" checked={!!activeDays[d.key]}
                        onChange={(e) => setActiveDays({ ...activeDays, [d.key]: e.target.checked })} />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="hours-row">
                <label>From <input type="time" value={hours.start} onChange={(e) => setHours({ ...hours, start: e.target.value })} /></label>
                <label>To <input type="time" value={hours.end} onChange={(e) => setHours({ ...hours, end: e.target.value })} /></label>
              </div>

              <button className="btn-primary">Create doctor</button>
            </form>
          </div>

          <h2>Doctors</h2>
          <div className="card-list">
            {doctors.map((d) => (
              <div key={d.id} className="card">
                <strong>Dr. {d.User?.name}</strong>
                <p className="muted">{d.specialization} · {d.slot_duration_minutes} min slots</p>
                <div className="inline-form">
                  <input type="date" onChange={(e) => setLeaveForm({ ...leaveForm, [d.id]: { ...leaveForm[d.id], date: e.target.value } })} />
                  <input placeholder="Reason (optional)" onChange={(e) => setLeaveForm({ ...leaveForm, [d.id]: { ...leaveForm[d.id], reason: e.target.value } })} />
                  <button className="btn-ghost" onClick={() => markLeave(d.id)}>Mark day as leave</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'appointments' && (
        <div className="card-list">
          {appointments.map((a) => (
            <div key={a.id} className={`card status-${a.status}`}>
              <div className="card-row">
                <strong>{a.patient?.name} → Dr. {a.doctor?.User?.name}</strong>
                <span className={`badge badge-${a.status}`}>{a.status}</span>
              </div>
              <p>{a.appointment_date} at {a.start_time}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
