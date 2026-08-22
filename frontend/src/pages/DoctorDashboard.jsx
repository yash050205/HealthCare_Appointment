import { useEffect, useState } from 'react';
import api from '../api/client';

export default function DoctorDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNotes, setActiveNotes] = useState({}); // { [apptId]: { notes, prescription } }

  async function load() {
    setLoading(true);
    const { data } = await api.get('/appointments/mine');
    setAppointments(data.appointments);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function updateDraft(id, field, value) {
    setActiveNotes((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function updateMed(id, index, field, value) {
    setActiveNotes((prev) => {
      const draft = prev[id] || { notes: '', prescription: [] };
      const prescription = [...(draft.prescription || [])];
      prescription[index] = { ...prescription[index], [field]: value };
      return { ...prev, [id]: { ...draft, prescription } };
    });
  }

  function addMed(id) {
    setActiveNotes((prev) => {
      const draft = prev[id] || { notes: '', prescription: [] };
      return { ...prev, [id]: { ...draft, prescription: [...(draft.prescription || []), { medicine: '', dosage: '', frequency_per_day: 1, duration_days: 5 }] } };
    });
  }

  async function submitPostVisit(id) {
    const draft = activeNotes[id] || {};
    await api.post(`/appointments/${id}/post-visit`, {
      notes: draft.notes || '',
      prescription: draft.prescription || [],
    });
    load();
  }

  async function connectCalendar() {
    const { data } = await api.get('/calendar/oauth/connect');
    window.location.href = data.url;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Your schedule</h1>
        <button className="btn-ghost" onClick={connectCalendar}>Connect Google Calendar</button>
      </div>

      {loading ? <p>Loading…</p> : appointments.length === 0 ? (
        <p className="empty-state">No appointments yet.</p>
      ) : (
        <div className="card-list">
          {appointments.map((a) => (
            <div key={a.id} className={`card status-${a.status}`}>
              <div className="card-row">
                <strong>{a.patient?.name}</strong>
                <span className={`badge badge-${a.status}`}>{a.status}</span>
              </div>
              <p>{a.appointment_date} at {a.start_time}</p>
              <p className="muted">Symptoms: {a.symptom_text || '—'}</p>

              {a.pre_visit_llm_status === 'success' && a.pre_visit_summary && (
                <div className="pre-visit-box">
                  <p><strong>Urgency:</strong> {a.pre_visit_summary.urgency_level}</p>
                  <p><strong>Chief complaint:</strong> {a.pre_visit_summary.chief_complaint}</p>
                  <ul>
                    {(a.pre_visit_summary.suggested_questions || []).map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                </div>
              )}
              {a.pre_visit_llm_status === 'failed' && (
                <p className="warning-text">AI pre-visit summary unavailable — review symptoms manually.</p>
              )}

              {a.status === 'booked' && (
                <details className="post-visit-form">
                  <summary>Submit post-visit notes</summary>
                  <label>Clinical notes</label>
                  <textarea rows={3} value={activeNotes[a.id]?.notes || ''}
                    onChange={(e) => updateDraft(a.id, 'notes', e.target.value)} />

                  <label>Prescription</label>
                  {(activeNotes[a.id]?.prescription || []).map((med, i) => (
                    <div key={i} className="med-row">
                      <input placeholder="Medicine" value={med.medicine}
                        onChange={(e) => updateMed(a.id, i, 'medicine', e.target.value)} />
                      <input placeholder="Dosage" value={med.dosage}
                        onChange={(e) => updateMed(a.id, i, 'dosage', e.target.value)} />
                      <input type="number" min={1} max={4} placeholder="Times/day" value={med.frequency_per_day}
                        onChange={(e) => updateMed(a.id, i, 'frequency_per_day', Number(e.target.value))} />
                      <input type="number" min={1} placeholder="Days" value={med.duration_days}
                        onChange={(e) => updateMed(a.id, i, 'duration_days', Number(e.target.value))} />
                    </div>
                  ))}
                  <button type="button" className="btn-ghost" onClick={() => addMed(a.id)}>+ Add medicine</button>
                  <button type="button" className="btn-primary" onClick={() => submitPostVisit(a.id)}>Submit & complete visit</button>
                </details>
              )}

              {a.post_visit_summary && (
                <details>
                  <summary>Patient-friendly summary sent</summary>
                  <p>{a.post_visit_summary}</p>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
