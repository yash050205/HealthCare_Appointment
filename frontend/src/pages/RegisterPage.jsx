import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/patient');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Create your account</h1>
      <form onSubmit={handleSubmit}>
        <label>Full name</label>
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

        <label>Email</label>
        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <label>Phone</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

        <label>Password</label>
        <input type="password" required minLength={6} value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />

        {error && <p className="error-text">{error}</p>}

        <button className="btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
      </form>
      <p>Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
