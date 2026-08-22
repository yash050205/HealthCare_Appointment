import { Link } from 'react-router-dom';

export default function CalendarConnected() {
  return (
    <div className="auth-card">
      <h1>Google Calendar connected ✅</h1>
      <p>Future appointments will now sync to your Google Calendar automatically.</p>
      <Link to="/" className="btn-primary-sm">Back to dashboard</Link>
    </div>
  );
}
