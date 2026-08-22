import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function FindDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [specialization, setSpecialization] = useState('');
  const navigate = useNavigate();

  async function load() {
    const { data } = await api.get('/doctors', { params: specialization ? { specialization } : {} });
    setDoctors(data.doctors);
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <h1>Find a doctor</h1>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input placeholder="Search by specialization (e.g. Cardiology)"
          value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
        <button className="btn-primary-sm">Search</button>
      </form>

      <div className="card-list">
        {doctors.map((d) => (
          <div key={d.id} className="card">
            <strong>Dr. {d.User?.name}</strong>
            <p className="muted">{d.specialization}</p>
            {d.bio && <p>{d.bio}</p>}
            <button className="btn-primary-sm" onClick={() => navigate(`/patient/book/${d.id}`)}>
              View slots & book
            </button>
          </div>
        ))}
        {doctors.length === 0 && <p className="empty-state">No doctors found.</p>}
      </div>
    </div>
  );
}
