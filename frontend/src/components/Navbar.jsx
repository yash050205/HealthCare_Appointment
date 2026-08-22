import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <Link to="/" className="brand">Clinic Appointments</Link>
      <nav className="nav-links">
        {user ? (
          <>
            <span className="nav-user">{user.name} · {user.role}</span>
            <button className="btn-ghost" onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register" className="btn-primary-sm">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  );
}
