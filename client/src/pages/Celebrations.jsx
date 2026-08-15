import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function typeLabel(type) {
  return type === 'birthday' ? 'Birthday' : 'Anniversary';
}

function formatChannelsLabel(channels = []) {
  const hasSms = channels.includes('sms');
  const hasWhatsApp = channels.includes('whatsapp');
  if (hasSms && hasWhatsApp) return 'SMS and WhatsApp';
  if (hasWhatsApp) return 'WhatsApp';
  if (hasSms) return 'SMS';
  return 'SMS and WhatsApp';
}

function formatLogStatus(status) {
  if (status === 'sent') return 'Sent';
  if (status === 'failed') return 'Failed';
  return status;
}

function formatLogChannel(channel) {
  if (channel === 'whatsapp') return 'WhatsApp';
  if (channel === 'sms') return 'SMS';
  if (channel === 'console') return 'Test mode';
  return channel;
}

export default function Celebrations() {
  const [today, setToday] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  async function load() {
    const [todayData, upcomingData, logData, settingsData] = await Promise.all([
      api('/celebrations/today'),
      api('/celebrations/upcoming?days=21'),
      api('/celebrations/logs'),
      api('/celebrations/settings'),
    ]);
    setToday(todayData);
    setUpcoming(upcomingData);
    setLogs(logData);
    setSettings(settingsData);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const deliveryLabel = useMemo(
    () => formatChannelsLabel(settings?.channels),
    [settings?.channels]
  );

  async function runAnnouncements() {
    setRunning(true);
    setMessage('');
    setError('');
    try {
      const result = await api('/celebrations/run', { method: 'POST' });
      const r = result.results || {};
      const parts = [];
      if (r.sent > 0) parts.push(`${r.sent} announcement${r.sent === 1 ? '' : 's'} sent`);
      if (r.skipped > 0) parts.push(`${r.skipped} already sent today`);
      if (r.failed > 0) parts.push(`${r.failed} could not be sent`);
      if (!parts.length) {
        parts.push(r.checked ? 'Nothing new to announce' : 'No celebrations today');
      }
      setMessage(parts.join(' · '));
      if (r.failed > 0) setError('Some announcements could not be sent. Check phone numbers and messaging setup.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  const todayItems = [
    ...(today?.birthdays || []),
    ...(today?.anniversaries || []),
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Celebrations</h1>
          <p className="muted">
            Send birthday and anniversary messages automatically each morning, or run them manually below.
          </p>
        </div>
        <button type="button" className="btn primary" onClick={runAnnouncements} disabled={running}>
          {running ? 'Sending…' : 'Send today\'s messages'}
        </button>
      </header>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="panel stack">
        <h2>How it works</h2>
        <p className="muted">
          Celebrants receive a personal message on <strong>{deliveryLabel}</strong> when it is their
          birthday or wedding anniversary.
        </p>
        <p className="muted">
          Message wording comes from{' '}
          <Link to="/messages" className="linkish">
            Message Hub
          </Link>{' '}
          (Birthday and Anniversary templates).
        </p>
        <p className="muted">
          {settings?.adminContactsConfigured ? (
            <>
              A short announcement digest is also sent to {settings.adminContactCount} admin contact
              {settings.adminContactCount === 1 ? '' : 's'}. Manage contacts in{' '}
              <Link to="/settings" className="linkish">
                Settings
              </Link>
              .
            </>
          ) : (
            <>
              Add admin contacts in{' '}
              <Link to="/settings" className="linkish">
                Settings
              </Link>{' '}
              to receive a daily announcement digest.
            </>
          )}
        </p>
      </section>

      <section className="panel-grid">
        <div className="panel">
          <h2>Today</h2>
          <ul className="log-list">
            {todayItems.map((item) => (
              <li key={`${item.type}-${item.members.map((m) => m._id).join('-')}`}>
                <strong>{item.label}</strong>
                <span>
                  {typeLabel(item.type)}
                  {item.years != null && item.years >= 0 ? ` · ${item.years} year(s)` : ''}
                </span>
              </li>
            ))}
            {!todayItems.length && (
              <li className="muted">No birthdays or anniversaries today.</li>
            )}
          </ul>
        </div>

        <div className="panel">
          <h2>Recent messages</h2>
          <ul className="log-list">
            {logs.map((log) => (
              <li key={log._id}>
                <strong>
                  {typeLabel(log.type)} · {log.members?.map((m) => m.name).join(' & ')}
                </strong>
                <span>
                  {formatLogStatus(log.status)} · {formatLogChannel(log.channel)} ·{' '}
                  {formatDate(log.createdAt)}
                </span>
              </li>
            ))}
            {!logs.length && <li className="muted">No celebration messages sent yet.</li>}
          </ul>
        </div>
      </section>

      <section className="panel">
        <h2>Coming up (21 days)</h2>

        <div className="data-list">
          {upcoming.map((item, idx) => (
            <article className="data-card" key={`${item.type}-${item.date}-${idx}`}>
              <div className="data-card-top">
                <div>
                  <h3>{item.label}</h3>
                  <p className="muted small">{formatDate(item.date)}</p>
                </div>
                <span className="pill muted">{typeLabel(item.type)}</span>
              </div>
              <dl className="meta-grid">
                <div>
                  <dt>Years</dt>
                  <dd>{item.years != null && item.years >= 0 ? item.years : '—'}</dd>
                </div>
              </dl>
            </article>
          ))}
          {!upcoming.length && (
            <p className="empty-state">No upcoming celebrations in the next 21 days.</p>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Celebration</th>
                <th>Years</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((item, idx) => (
                <tr key={`${item.type}-${item.date}-${idx}`}>
                  <td>{formatDate(item.date)}</td>
                  <td>{typeLabel(item.type)}</td>
                  <td>{item.label}</td>
                  <td>{item.years != null && item.years >= 0 ? item.years : '—'}</td>
                </tr>
              ))}
              {!upcoming.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    No upcoming celebrations in the next 21 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
