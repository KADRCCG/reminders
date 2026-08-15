import { useEffect, useState } from 'react';
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

export default function Celebrations() {
  const [today, setToday] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  async function load() {
    const [todayData, upcomingData, logData] = await Promise.all([
      api('/celebrations/today'),
      api('/celebrations/upcoming?days=21'),
      api('/celebrations/logs'),
    ]);
    setToday(todayData);
    setUpcoming(upcomingData);
    setLogs(logData);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function runAnnouncements() {
    setRunning(true);
    setMessage('');
    setError('');
    try {
      const result = await api('/celebrations/run', { method: 'POST' });
      setMessage(
        `Checked ${result.results.checked} · sent ${result.results.sent} · skipped ${result.results.skipped} · failed ${result.results.failed}`
      );
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
            Birthdays and anniversaries are sent on WhatsApp each morning.
          </p>
        </div>
        <button type="button" className="btn primary" onClick={runAnnouncements} disabled={running}>
          {running ? 'Announcing…' : 'Announce today now'}
        </button>
      </header>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

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
            {!todayItems.length && <li className="muted">No birthdays or anniversaries today.</li>}
          </ul>
        </div>

        <div className="panel">
          <h2>Recent announcements</h2>
          <ul className="log-list">
            {logs.map((log) => (
              <li key={log._id}>
                <strong>
                  {typeLabel(log.type)} · {log.members?.map((m) => m.name).join(' & ')}
                </strong>
                <span>
                  {log.status} via {log.channel} · {formatDate(log.createdAt)}
                </span>
              </li>
            ))}
            {!logs.length && <li className="muted">No celebration announcements yet.</li>}
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
