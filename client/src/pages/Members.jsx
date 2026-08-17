import { useEffect, useState } from 'react';
import { api } from '../api';

const empty = {
  name: '',
  email: '',
  phone: '',
  department: '',
  birthdayMonth: '',
  birthdayDay: '',
  birthdayYear: '',
  spouse: '',
  anniversaryMonth: '',
  anniversaryDay: '',
  anniversaryYear: '',
};

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

function formatMonthDayYear(month, day, year, legacyDate) {
  if (!month || !day) {
    if (!legacyDate) return '—';
    return new Date(legacyDate).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  const monthLabel = MONTHS.find((m) => m.value === month)?.label?.slice(0, 3);
  const base = `${monthLabel} ${day}`;
  return year ? `${base}, ${year}` : base;
}

function MonthDayYearFields({ legend, prefix, form, setForm, disabled = false }) {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const monthKey = `${prefix}Month`;
  const dayKey = `${prefix}Day`;
  const yearKey = `${prefix}Year`;

  return (
    <fieldset className="birthday-fields" disabled={disabled}>
      <legend>
        {legend} <span className="muted small">(year optional)</span>
      </legend>
      <div className="birthday-grid">
        <label>
          Month
          <select
            value={form[monthKey]}
            onChange={(e) => setForm({ ...form, [monthKey]: e.target.value })}
          >
            <option value="">—</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Day
          <select
            value={form[dayKey]}
            onChange={(e) => setForm({ ...form, [dayKey]: e.target.value })}
          >
            <option value="">—</option>
            {days.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          Year
          <input
            type="number"
            min="1900"
            max="2100"
            placeholder="Optional"
            value={form[yearKey]}
            onChange={(e) => setForm({ ...form, [yearKey]: e.target.value })}
          />
        </label>
      </div>
    </fieldset>
  );
}

export default function Members() {
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [memberData, deptData] = await Promise.all([api('/members'), api('/departments')]);
    setMembers(memberData);
    setDepartments(deptData);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(empty);
  }

  function startEdit(member) {
    setEditingId(member._id);
    setForm({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      department: member.department?._id || member.department || '',
      birthdayMonth: member.birthdayMonth || '',
      birthdayDay: member.birthdayDay || '',
      birthdayYear: member.birthdayYear || '',
      spouse: member.spouse?._id || member.spouse || '',
      anniversaryMonth: member.anniversaryMonth || '',
      anniversaryDay: member.anniversaryDay || '',
      anniversaryYear: member.anniversaryYear || '',
    });
    setMessage('');
    setError('');
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const body = {
        ...form,
        department: form.department || null,
        spouse: form.spouse || null,
        birthdayMonth: form.birthdayMonth || null,
        birthdayDay: form.birthdayDay || null,
        birthdayYear: form.birthdayYear || null,
        anniversaryMonth: form.spouse ? form.anniversaryMonth || null : null,
        anniversaryDay: form.spouse ? form.anniversaryDay || null : null,
        anniversaryYear: form.spouse ? form.anniversaryYear || null : null,
      };

      if (editingId) {
        await api(`/members/${editingId}`, { method: 'PUT', body });
        setMessage('Member updated.');
      } else {
        await api('/members', { method: 'POST', body });
        setMessage('Member added.');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Remove this person?')) return;
    await api(`/members/${id}`, { method: 'DELETE' });
    if (editingId === id) resetForm();
    await load();
  }

  async function onUpload(e) {
    e.preventDefault();
    if (!file) {
      setError('Choose a CSV file first');
      return;
    }
    setError('');
    setMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await api('/members/upload', { method: 'POST', body });
      setMessage(
        `Uploaded people: ${result.created} created, ${result.updated} updated.${
          result.errors?.length ? ` ${result.errors.length} row(s) had issues.` : ''
        }`
      );
      if (result.errors?.length) {
        setError(result.errors.slice(0, 5).join(' · '));
      }
      setFile(null);
      e.target.reset();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const spouseOptions = members.filter((m) => m._id !== editingId);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>People</h1>
          <p className="muted">
            Phone is used for SMS schedule reminders and WhatsApp celebration messages.
          </p>
        </div>
      </header>

      {message && <p className="success">{message}</p>}
      {error && !editingId && <p className="error">{error}</p>}

      <section className="panel-grid">
        <div className="stack">
          <form className="panel stack" onSubmit={onUpload}>
            <h2>Bulk upload</h2>
            <p className="muted small">
              Columns: name, phone, email (optional), department, birthdayMonth, birthdayDay,
              birthdayYear, spouseEmail, anniversaryMonth, anniversaryDay, anniversaryYear
            </p>
            <label className="file-input">
              CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <button className="btn primary" type="submit">
              Upload people
            </button>
          </form>

        <form className="panel stack" onSubmit={onSubmit}>
          <h2>{editingId ? 'Edit person' : 'Add person'}</h2>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Email <span className="muted small">(optional)</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Phone <span className="muted small">(for SMS / WhatsApp)</span>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="087... or +353 87..."
              required
            />
          </label>
          <label>
            Department <span className="muted small">(optional)</span>
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          <MonthDayYearFields
            legend="Birthday"
            prefix="birthday"
            form={form}
            setForm={setForm}
          />

          <label>
            Married to (another member)
            <select
              value={form.spouse}
              onChange={(e) => setForm({ ...form, spouse: e.target.value })}
            >
              <option value="">Not married / not linked</option>
              {spouseOptions.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <MonthDayYearFields
            legend="Wedding anniversary"
            prefix="anniversary"
            form={form}
            setForm={setForm}
            disabled={!form.spouse}
          />

          {error && <p className="error">{error}</p>}
          <div className="row-actions">
            <button className="btn primary" type="submit">
              {editingId ? 'Save changes' : 'Save person'}
            </button>
            {editingId && (
              <button type="button" className="linkish" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
        </div>

        <div className="panel directory-panel">
          <h2>Directory</h2>

          <div className="data-list">
            {members.map((m) => (
              <article className="data-card" key={m._id}>
                <div className="data-card-top">
                  <div>
                    <h3>{m.name}</h3>
                    {m.email && <p className="muted small">{m.email}</p>}
                    {m.phone && <p className="muted small">{m.phone}</p>}
                  </div>
                  <div className="data-card-actions">
                    <button type="button" className="btn ghost" onClick={() => startEdit(m)}>
                      Edit
                    </button>
                    <button type="button" className="btn danger-ghost" onClick={() => remove(m._id)}>
                      Remove
                    </button>
                  </div>
                </div>
                <dl className="meta-grid">
                  <div>
                    <dt>Department</dt>
                    <dd>{m.department?.name || '—'}</dd>
                  </div>
                  <div>
                    <dt>Birthday</dt>
                    <dd>
                      {formatMonthDayYear(
                        m.birthdayMonth,
                        m.birthdayDay,
                        m.birthdayYear,
                        m.birthday
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Spouse</dt>
                    <dd>{m.spouse?.name || '—'}</dd>
                  </div>
                  <div>
                    <dt>Anniversary</dt>
                    <dd>
                      {formatMonthDayYear(
                        m.anniversaryMonth,
                        m.anniversaryDay,
                        m.anniversaryYear,
                        m.weddingAnniversary
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
            {!members.length && <p className="empty-state">No people yet.</p>}
          </div>

          <div className="table-wrap">
            <table className="directory-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Birthday</th>
                  <th>Spouse</th>
                  <th>Anniversary</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <div className="cell-title">{m.name}</div>
                      <div className="muted small">{m.email || '—'}</div>
                    </td>
                    <td>{m.department?.name || '—'}</td>
                    <td>
                      {formatMonthDayYear(
                        m.birthdayMonth,
                        m.birthdayDay,
                        m.birthdayYear,
                        m.birthday
                      )}
                    </td>
                    <td>{m.spouse?.name || '—'}</td>
                    <td>
                      {formatMonthDayYear(
                        m.anniversaryMonth,
                        m.anniversaryDay,
                        m.anniversaryYear,
                        m.weddingAnniversary
                      )}
                    </td>
                    <td className="actions-col">
                      <div className="table-actions">
                        <button type="button" className="action-link" onClick={() => startEdit(m)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="action-link danger"
                          onClick={() => remove(m._id)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!members.length && (
                  <tr>
                    <td colSpan={6} className="muted">
                      No people yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
