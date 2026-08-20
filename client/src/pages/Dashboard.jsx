import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatReminderRulesLabel } from '../utils/reminderRules';
import { scheduleDepartmentsLabel } from '../utils/scheduleDepartments';

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function reminderLabel(item) {
  if (item.reminderSentAt) return 'Sent';
  return formatReminderRulesLabel(item.schedule);
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [celebrations, setCelebrations] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  async function load() {
    try {
      const [payload, todayCelebrations] = await Promise.all([
        api('/reminders/dashboard'),
        api('/celebrations/today'),
      ]);
      setData(payload);
      setCelebrations(todayCelebrations);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function runReminders() {
    setRunning(true);
    setMessage('');
    setError('');
    try {
      const result = await api('/reminders/run', { method: 'POST' });
      const r = result.results || {};
      const parts = [];
      if (r.sent > 0) parts.push(`${r.sent} reminder${r.sent === 1 ? '' : 's'} sent`);
      if (r.skipped > 0) parts.push(`${r.skipped} not due yet`);
      if (r.failed > 0) parts.push(`${r.failed} failed`);
      if (!parts.length) {
        parts.push(r.checked ? 'Nothing to send right now' : 'No upcoming assignments to check');
      }
      setMessage(parts.join(' · '));

      if (r.failed > 0) {
        const failNotes = (r.reasons || [])
          .filter((line) => /failed|phone|invalid|not configured/i.test(line))
          .slice(0, 3);
        setError(failNotes.join(' · ') || 'Some reminders could not be sent.');
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  if (!data && !error) return <p className="muted">Loading overview…</p>;

  const stats = data?.stats || {};
  const todayCelebrations = [
    ...(celebrations?.birthdays || []),
    ...(celebrations?.anniversaries || []),
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">
            SMS reminders follow each schedule&apos;s reminder rules from the first matching day through
            the service date.
          </p>
        </div>
        <button type="button" className="btn primary" onClick={runReminders} disabled={running}>
          {running ? 'Sending…' : 'Run reminders now'}
        </button>
      </header>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2>Celebrating today</h2>
        <ul className="log-list">
          {todayCelebrations.map((item) => (
            <li key={`${item.type}-${item.members.map((m) => m._id).join('-')}`}>
              <strong>{item.label}</strong>
              <span>
                {item.type === 'birthday' ? 'Birthday' : 'Wedding anniversary'}
                {item.years != null && item.years >= 0 ? ` · ${item.years} year(s)` : ''}
              </span>
            </li>
          ))}
          {!todayCelebrations.length && (
            <li className="muted">No birthdays or anniversaries today.</li>
          )}
        </ul>
      </section>

      <section className="stat-grid">
        <article>
          <p className="stat-label">Next 7 days</p>
          <p className="stat-value">{stats.upcomingWeek ?? 0}</p>
        </article>
        <article>
          <p className="stat-label">Upcoming total</p>
          <p className="stat-value">{stats.totalUpcoming ?? 0}</p>
        </article>
        <article>
          <p className="stat-label">Reminders sent</p>
          <p className="stat-value">{stats.remindersSent ?? 0}</p>
        </article>
        <article>
          <p className="stat-label">Still pending</p>
          <p className="stat-value">{stats.pendingReminders ?? 0}</p>
        </article>
      </section>

      <section className="split">
        <div className="panel">
          <h2>Upcoming assignments</h2>

          <div className="data-list">
            {(data?.upcoming || []).map((item) => (
              <article className="data-card" key={item._id}>
                <div className="data-card-top">
                  <div>
                    <h3>{item.member?.name}</h3>
                    <p className="muted small">{formatDate(item.date)}</p>
                  </div>
                  <span className={`pill ${item.reminderSentAt ? 'ok' : 'warn'}`}>
                    {reminderLabel(item)}
                  </span>
                </div>
                <dl className="meta-grid">
                  <div>
                    <dt>Schedule</dt>
                    <dd>{item.schedule?.name || '—'}</dd>
                  </div>
                  <div>
                    <dt>Department</dt>
                    <dd>{scheduleDepartmentsLabel(item.schedule) || '—'}</dd>
                  </div>
                  <div>
                    <dt>Assignment</dt>
                    <dd>{item.roleLabel || '—'}</dd>
                  </div>
                </dl>
              </article>
            ))}
            {!data?.upcoming?.length && (
              <p className="empty-state">No upcoming entries yet. Create a schedule to begin.</p>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Schedule</th>
                  <th>Department</th>
                  <th>Person</th>
                  <th>Assignment</th>
                  <th>Reminder</th>
                </tr>
              </thead>
              <tbody>
                {(data?.upcoming || []).map((item) => (
                  <tr key={item._id}>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.schedule?.name}</td>
                    <td>{scheduleDepartmentsLabel(item.schedule) || '—'}</td>
                    <td>{item.member?.name}</td>
                    <td>{item.roleLabel}</td>
                    <td>
                      <span className={`pill ${item.reminderSentAt ? 'ok' : 'warn'}`}>
                        {reminderLabel(item)}
                      </span>
                    </td>
                  </tr>
                ))}
                {!data?.upcoming?.length && (
                  <tr>
                    <td colSpan={6} className="muted">
                      No upcoming entries yet. Create a schedule to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Recent reminder activity</h2>
          <ul className="log-list">
            {(data?.recentLogs || []).map((log) => (
              <li key={log._id}>
                <strong>{log.member?.name || 'Unknown'}</strong>
                <span>
                  {log.status}
                  {log.scheduleEntry?.schedule?.name ? ` · ${log.scheduleEntry.schedule.name}` : ''}
                  {log.createdAt ? ` · ${formatDate(log.createdAt)}` : ''}
                </span>
              </li>
            ))}
            {!data?.recentLogs?.length && (
              <li className="muted">No reminders sent yet.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
