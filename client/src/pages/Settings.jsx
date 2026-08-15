import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [newAdminContact, setNewAdminContact] = useState('');
  const [savingContacts, setSavingContacts] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const data = await api('/settings');
    setSettings(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function saveAdminContacts(contacts) {
    setSavingContacts(true);
    setError('');
    setMessage('');
    try {
      const updated = await api('/settings/admin-contacts', {
        method: 'PUT',
        body: { adminContacts: contacts },
      });
      setSettings(updated);
      setMessage('Admin contacts saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingContacts(false);
    }
  }

  async function onAddAdminContact(e) {
    e.preventDefault();
    const phone = newAdminContact.trim();
    if (!phone) return;
    const next = [...(settings?.adminContacts || []), phone];
    await saveAdminContacts(next);
    setNewAdminContact('');
  }

  async function removeAdminContact(phone) {
    const next = (settings?.adminContacts || []).filter((p) => p !== phone);
    await saveAdminContacts(next);
  }

  async function onChangePassword(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
      });
      setMessage('Password updated.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Manage your account and celebration announcement contacts.</p>
        </div>
      </header>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="panel stack">
        <h2>Account</h2>
        <p className="muted">
          Signed in as <strong>{user?.name}</strong> ({user?.email})
        </p>
      </section>

      <section className="panel stack">
        <h2>Change password</h2>
        <form className="stack" onSubmit={onChangePassword}>
          <label>
            Current password
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
              }
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
              }
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          <button className="btn primary" type="submit" disabled={changingPassword}>
            {changingPassword ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <h2>Admin announcement contacts</h2>
        <p className="muted small">
          These phone numbers receive the daily birthday and anniversary digest (admin announcement
          templates from{' '}
          <Link to="/messages" className="linkish">
            Message Hub
          </Link>
          ).
        </p>

        <ul className="log-list">
          {(settings?.adminContacts || []).map((phone) => (
            <li key={phone}>
              <strong>{phone}</strong>
              <button
                type="button"
                className="btn danger-ghost"
                onClick={() => removeAdminContact(phone)}
                disabled={savingContacts}
              >
                Remove
              </button>
            </li>
          ))}
          {!settings?.adminContacts?.length && (
            <li className="muted">No admin contacts yet.</li>
          )}
        </ul>

        <form className="stack" onSubmit={onAddAdminContact}>
          <label>
            Phone number
            <input
              type="tel"
              placeholder="+353 87 123 4567"
              value={newAdminContact}
              onChange={(e) => setNewAdminContact(e.target.value)}
            />
          </label>
          <button className="btn primary" type="submit" disabled={savingContacts || !newAdminContact.trim()}>
            Add contact
          </button>
        </form>
      </section>
    </div>
  );
}
