import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function BookAppointment() {
  const { doctorId } = useParams();
  const navigate = useNavigate();

  const [slots, setSlots] = useState([]);
  const [heldSlot, setHeldSlot] = useState(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState(null);
  const [symptomText, setSymptomText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    api.get(`/doctors/${doctorId}/slots`).then(({ data }) => setSlots(data.slots));
  }, [doctorId]);

  useEffect(() => {
    if (!holdExpiresAt) return;
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.floor((new Date(holdExpiresAt) - new Date()) / 1000));
      setRemaining(secs);
      if (secs === 0) {
        setHeldSlot(null);
        setHoldExpiresAt(null);
        setError('Your hold expired. Please select a slot again.');
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  async function selectSlot(slot) {
    setError('');
    try {
      const { data } = await api.post('/appointments/hold', { slotId: slot.id });
      setHeldSlot(data.slot);
      setHoldExpiresAt(data.holdExpiresAt);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not hold this slot. It may already be taken.');
      const { data } = await api.get(`/doctors/${doctorId}/slots`);
      setSlots(data.slots);
    }
  }

  async function confirmBooking(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/appointments/confirm', { slotId: heldSlot.id, symptomText });
      navigate('/patient');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not confirm booking.');
    } finally {
      setSubmitting(false);
    }
  }

  const grouped = slots.reduce((acc, s) => {
    (acc[s.slot_date] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <h1>Book an appointment</h1>
      {error && <p className="error-text">{error}</p>}

      {!heldSlot ? (
        <>
          <p className="muted">Select an open slot. Once selected, it's held for you for a few minutes while you fill in your symptoms.</p>
          {Object.keys(grouped).length === 0 && <p className="empty-state">No open slots in the next two weeks.</p>}
          {Object.entries(grouped).map(([date, daySlots]) => (
            <div key={date} className="slot-day">
              <h3>{date}</h3>
              <div className="slot-grid">
                {daySlots.map((s) => (
                  <button key={s.id} className="slot-btn" onClick={() => selectSlot(s)}>
                    {s.start_time.slice(0, 5)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="card">
          <p>Slot held: <strong>{heldSlot.slot_date} at {heldSlot.start_time.slice(0, 5)}</strong></p>
          <p className="muted">Hold expires in {remaining}s</p>
          <form onSubmit={confirmBooking}>
            <label>Describe your symptoms</label>
            <textarea rows={5} required value={symptomText}
              onChange={(e) => setSymptomText(e.target.value)}
              placeholder="e.g. Fever for 2 days, mild headache, sore throat..." />
            <button className="btn-primary" disabled={submitting}>
              {submitting ? 'Confirming…' : 'Confirm booking'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
