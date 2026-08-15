import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const NEW_ASSIGNMENT = '__new__';

const empty = {
  department: '',
  member: '',
  date: '',
  roleLabel: '',
  customAssignment: '',
  notes: '',
};

const emptyFilters = {
  department: '',
  member: '',
  roleLabel: '',
  from: '',
  reminder: 'all',
};

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toDayValue(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function toDateInputValue(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function Schedule() {
  const [assignments, setAssignments] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [members, setMembers] = useState([]);
  const [assignmentLabels, setAssignmentLabels] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [assignmentData, deptData, memberData, labelData] = await Promise.all([
      api('/assignments'),
      api('/departments'),
      api('/members'),
      api('/assignment-labels'),
    ]);
    setAssignments(assignmentData);
    setDepartments(deptData);
    setMembers(memberData);
    setAssignmentLabels(labelData);
    setForm((prev) => ({
      ...prev,
      department: prev.department || deptData[0]?._id || '',
      member: prev.member || memberData[0]?._id || '',
      roleLabel:
        prev.roleLabel ||
        (labelData.some((l) => l.name === 'Serve') ? 'Serve' : labelData[0]?.name || NEW_ASSIGNMENT),
    }));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const filteredMembers = members.filter((m) => {
    if (!form.department) return true;
    if (!m.department) return true;
    return m.department?._id === form.department || m.department === form.department;
  });

  const filterMembers = useMemo(() => {
    if (!filters.department) return members;
    return members.filter((m) => {
      if (!m.department) return true;
      return m.department?._id === filters.department || m.department === filters.department;
    });
  }, [members, filters.department]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (filters.department) {
        const deptId = a.department?._id || a.department;
        if (deptId !== filters.department) return false;
      }

      if (filters.member) {
        const memberId = a.member?._id || a.member;
        if (memberId !== filters.member) return false;
      }

      if (filters.roleLabel) {
        if ((a.roleLabel || '').toLowerCase() !== filters.roleLabel.toLowerCase()) {
          return false;
        }
      }

      const day = toDayValue(a.date);
      if (filters.from) {
        const from = toDayValue(filters.from);
        if (day == null || from == null || day < from) return false;
      }

      if (filters.reminder === 'sent' && !a.reminderSentAt) return false;
      if (filters.reminder === 'pending' && a.reminderSentAt) return false;

      return true;
    });
  }, [assignments, filters]);

  const filtersActive =
    Boolean(filters.department) ||
    Boolean(filters.member) ||
    Boolean(filters.roleLabel) ||
    Boolean(filters.from) ||
    filters.reminder !== 'all';

  function resetForm(preferredRole = '') {
    setEditingId(null);
    setForm({
      ...empty,
      department: departments[0]?._id || '',
      member: '',
      roleLabel:
        preferredRole ||
        (assignmentLabels.some((l) => l.name === 'Serve')
          ? 'Serve'
          : assignmentLabels[0]?.name || ''),
    });
  }

  function startEdit(assignment) {
    const roleLabel = assignment.roleLabel || '';
    const knownLabel = assignmentLabels.find(
      (l) => l.name.toLowerCase() === roleLabel.toLowerCase()
    );
    setEditingId(assignment._id);
    setForm({
      department: assignment.department?._id || assignment.department || '',
      member: assignment.member?._id || assignment.member || '',
      date: toDateInputValue(assignment.date),
      roleLabel: knownLabel ? knownLabel.name : NEW_ASSIGNMENT,
      customAssignment: knownLabel ? '' : roleLabel,
      notes: assignment.notes || '',
    });
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onManualSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const roleLabel =
        form.roleLabel === NEW_ASSIGNMENT
          ? form.customAssignment.trim()
          : form.roleLabel.trim();

      if (!roleLabel) {
        setError('Choose or enter an assignment');
        return;
      }

      const body = {
        department: form.department,
        member: form.member,
        date: form.date,
        roleLabel,
        notes: form.notes,
      };

      if (editingId) {
        await api(`/assignments/${editingId}`, { method: 'PUT', body });
        setMessage('Assignment updated.');
      } else {
        await api('/assignments', { method: 'POST', body });
        setMessage('Assignment added.');
      }
      resetForm(roleLabel);
      await load();
    } catch (err) {
      setError(err.message);
    }
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
      const result = await api('/assignments/upload', { method: 'POST', body });
      setMessage(
        `Uploaded ${result.created} assignment(s).${
          result.errors?.length ? ` ${result.errors.length} row(s) skipped.` : ''
        }`
      );
      setFile(null);
      e.target.reset();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this assignment?')) return;
    await api(`/assignments/${id}`, { method: 'DELETE' });
    if (editingId === id) resetForm();
    await load();
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Schedule</h1>
          <p className="muted">
            Upload the month or quarter once. People get reminded automatically.
          </p>
        </div>
      </header>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="panel-grid">
        <form className="panel stack" onSubmit={onUpload}>
          <h2>Upload CSV</h2>
          <p className="muted small">
            Columns: date, department, member, email, assignment, notes
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
            Upload schedule
          </button>
        </form>

        <form className="panel stack" onSubmit={onManualSubmit}>
          <h2>{editingId ? 'Edit assignment' : 'Add one assignment'}</h2>
          <label>
            Department
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value, member: '' })}
              required
            >
              <option value="" disabled>
                Select
              </option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Person
            <select
              value={form.member}
              onChange={(e) => setForm({ ...form, member: e.target.value })}
              required
            >
              <option value="" disabled>
                Select
              </option>
              {filteredMembers.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </label>
          <label>
            Assignment
            <select
              value={form.roleLabel}
              onChange={(e) =>
                setForm({
                  ...form,
                  roleLabel: e.target.value,
                  customAssignment:
                    e.target.value === NEW_ASSIGNMENT ? form.customAssignment : '',
                })
              }
              required
            >
              <option value="" disabled>
                Select assignment
              </option>
              {assignmentLabels.map((label) => (
                <option key={label._id} value={label.name}>
                  {label.name}
                </option>
              ))}
              <option value={NEW_ASSIGNMENT}>+ Add new assignment</option>
            </select>
          </label>
          {form.roleLabel === NEW_ASSIGNMENT && (
            <label>
              New assignment name
              <input
                value={form.customAssignment}
                onChange={(e) => setForm({ ...form, customAssignment: e.target.value })}
                placeholder="e.g. Teach, Lead Usher"
                required
              />
            </label>
          )}
          <label>
            Notes
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional instructions"
            />
          </label>
          <div className="row-actions">
            <button className="btn primary" type="submit">
              {editingId ? 'Save changes' : 'Save assignment'}
            </button>
            {editingId && (
              <button type="button" className="btn ghost" onClick={() => resetForm()}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>All assignments</h2>
            <p className="muted small">
              Showing {filteredAssignments.length} of {assignments.length}
            </p>
          </div>
          {filtersActive && (
            <button
              type="button"
              className="linkish"
              onClick={() => setFilters(emptyFilters)}
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="filter-bar">
          <label>
            Department
            <select
              value={filters.department}
              onChange={(e) =>
                setFilters({ ...filters, department: e.target.value, member: '' })
              }
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Person
            <select
              value={filters.member}
              onChange={(e) => setFilters({ ...filters, member: e.target.value })}
            >
              <option value="">All people</option>
              {filterMembers.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assignment
            <select
              value={filters.roleLabel}
              onChange={(e) => setFilters({ ...filters, roleLabel: e.target.value })}
            >
              <option value="">All assignments</option>
              {assignmentLabels.map((label) => (
                <option key={label._id} value={label.name}>
                  {label.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </label>
          <label>
            Reminder
            <select
              value={filters.reminder}
              onChange={(e) => setFilters({ ...filters, reminder: e.target.value })}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
            </select>
          </label>
        </div>

        <div className="data-list">
          {filteredAssignments.map((a) => (
            <article className="data-card" key={a._id}>
              <div className="data-card-top">
                <div>
                  <h3>{a.member?.name}</h3>
                  <p className="muted small">{formatDate(a.date)}</p>
                </div>
                <div className="data-card-actions">
                  <span className={`pill ${a.reminderSentAt ? 'ok' : 'warn'}`}>
                    {a.reminderSentAt ? 'Sent' : 'Pending'}
                  </span>
                  <button type="button" className="btn ghost" onClick={() => startEdit(a)}>
                    Edit
                  </button>
                  <button type="button" className="btn danger-ghost" onClick={() => remove(a._id)}>
                    Delete
                  </button>
                </div>
              </div>
              <dl className="meta-grid">
                <div>
                  <dt>Department</dt>
                  <dd>{a.department?.name || '—'}</dd>
                </div>
                <div>
                  <dt>Assignment</dt>
                  <dd>{a.roleLabel || '—'}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{a.notes || '—'}</dd>
                </div>
              </dl>
            </article>
          ))}
          {!filteredAssignments.length && (
            <p className="empty-state">
              {assignments.length ? 'No assignments match these filters.' : 'No schedule entries yet.'}
            </p>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Department</th>
                <th>Person</th>
                <th>Assignment</th>
                <th>Notes</th>
                <th>Reminder</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map((a) => (
                <tr key={a._id}>
                  <td>{formatDate(a.date)}</td>
                  <td>{a.department?.name}</td>
                  <td>{a.member?.name}</td>
                  <td>{a.roleLabel}</td>
                  <td>{a.notes || '—'}</td>
                  <td>
                    <span className={`pill ${a.reminderSentAt ? 'ok' : 'warn'}`}>
                      {a.reminderSentAt ? 'Sent' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="btn ghost" onClick={() => startEdit(a)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn danger-ghost"
                        onClick={() => remove(a._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredAssignments.length && (
                <tr>
                  <td colSpan={7} className="muted">
                    {assignments.length
                      ? 'No assignments match these filters.'
                      : 'No schedule entries yet.'}
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
