import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-brand">
          <img className="brand-logo" src="/rccg-logo.png" alt="RCCG-KAD logo" />
          <div className="brand-copy">
            <p className="brand">RCCG-KAD</p>
            <p className="brand-sub">Workforce Reminders</p>
          </div>
        </div>
        <h1>Sign in to manage schedules</h1>
        <p className="muted">
          Upload department schedules once per quarter. Reminders go out automatically.
        </p>

        <form onSubmit={onSubmit} className="stack">
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={busy} type="submit">
            {busy ? 'Please wait…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
