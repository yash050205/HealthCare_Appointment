import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (user.role === 'patient') navigate('/patient');
      else if (user.role === 'doctor') navigate('/doctor');
      else navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Log in</h1>
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input type="email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <label>Password</label>
        <input type="password" required value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />

        {error && <p className="error-text">{error}</p>}

        <button className="btn-primary" disabled={loading}>{loading ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p>New patient? <Link to="/register">Create an account</Link></p>
      <p className="hint-text">Doctor and admin accounts are created by the clinic admin.</p>
    </div>
  );
}
