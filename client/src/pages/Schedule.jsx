import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { templateDisplayTitle } from '../utils/templateDisplay';
import ScheduleMessageEditor from '../components/ScheduleMessageEditor';

const NEW_ASSIGNMENT = '__new__';

function isScheduleTemplate(tpl) {
  return (
    tpl?.placeholders?.includes('schedule') ||
    String(tpl?.key || '').startsWith('schedule_') ||
    tpl?.kind === 'custom'
  );
}

function defaultScheduleTemplate(templates) {
  return (
    templates.find((t) => t.key === 'schedule_reminder') ||
    templates.find((t) => isScheduleTemplate(t)) ||
    null
  );
}

function formatChannelsLabel(channels) {
  if (!channels?.length) return 'SMS';
  const hasSms = channels.includes('sms');
  const hasWhatsApp = channels.includes('whatsapp');
  if (hasSms && hasWhatsApp) return 'SMS & WhatsApp';
  if (hasWhatsApp) return 'WhatsApp';
  return 'SMS';
}

function ChannelDropdown({ sendSms, sendWhatsApp, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const channels = [];
  if (sendSms) channels.push('sms');
  if (sendWhatsApp) channels.push('whatsapp');

  function updateChannel(field, checked) {
    onChange({
      sendSms: field === 'sendSms' ? checked : sendSms,
      sendWhatsApp: field === 'sendWhatsApp' ? checked : sendWhatsApp,
    });
  }

  return (
    <div className="channel-dropdown-wrap" ref={wrapRef}>
      <span className="channel-dropdown-label">Delivery channel</span>
      <button
        type="button"
        className={`channel-dropdown-trigger${open ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {channels.length ? formatChannelsLabel(channels) : 'Select channels'}
      </button>
      {open && (
        <div className="channel-dropdown-menu" role="listbox">
          <label className="channel-dropdown-option">
            <input
              type="checkbox"
              checked={sendSms}
              onChange={(e) => updateChannel('sendSms', e.target.checked)}
            />
            SMS
          </label>
          <label className="channel-dropdown-option">
            <input
              type="checkbox"
              checked={sendWhatsApp}
              onChange={(e) => updateChannel('sendWhatsApp', e.target.checked)}
            />
            WhatsApp
          </label>
        </div>
      )}
    </div>
  );
}

function scheduleChannels(schedule) {
  if (schedule?.channels?.length) return schedule.channels;
  return schedule?.channel === 'whatsapp' ? ['whatsapp'] : ['sms'];
}

function scheduleMessageLabel(schedule) {
  if (schedule?.messageTemplate) return templateDisplayTitle(schedule.messageTemplate);
  if (schedule?.messageBody?.trim()) return 'Custom message';
  return '—';
}

function scheduleFormFromData(schedule, templates) {
  const channels = scheduleChannels(schedule);
  const mt = schedule?.messageTemplate;
  const templateId = mt?._id || mt || '';
  const storedBody = schedule?.messageBody?.trim() || '';
  const template =
    templates.find((t) => t._id === templateId) || defaultScheduleTemplate(templates);
  const messageMode = templateId ? 'template' : 'custom';

  return {
    name: schedule.name,
    department: schedule.department?._id || schedule.department,
    sendSms: channels.includes('sms'),
    sendWhatsApp: channels.includes('whatsapp'),
    messageMode,
    messageTemplateId: templateId ? String(templateId) : String(defaultScheduleTemplate(templates)?._id || ''),
    messageBody: storedBody || template?.body || '',
    notes: schedule.notes || '',
  };
}

const emptyCreate = {
  name: '',
  department: '',
  sendSms: true,
  sendWhatsApp: false,
  messageMode: 'template',
  messageTemplateId: '',
  messageBody: '',
  notes: '',
  addFirstPerson: false,
  member: '',
  date: '',
  roleLabel: '',
  customAssignment: '',
  entryNotes: '',
};

const emptyEntry = {
  member: '',
  date: '',
  roleLabel: '',
  customAssignment: '',
  notes: '',
};

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
  const { id } = useParams();
  const navigate = useNavigate();

  const [schedules, setSchedules] = useState([]);
  const [detail, setDetail] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [members, setMembers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [assignmentLabels, setAssignmentLabels] = useState([]);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [entryForm, setEntryForm] = useState(emptyEntry);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [settingsForm, setSettingsForm] = useState(null);
  const [file, setFile] = useState(null);
  const [uploadIssues, setUploadIssues] = useState([]);
  const [uploadWarnings, setUploadWarnings] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleDepartment, setScheduleDepartment] = useState('');

  const scheduleTemplates = useMemo(
    () => templates.filter((t) => isScheduleTemplate(t)),
    [templates]
  );

  function buildChannelsPayload(form) {
    const channels = [];
    if (form.sendSms) channels.push('sms');
    if (form.sendWhatsApp) channels.push('whatsapp');
    if (!channels.length) {
      throw new Error('Select at least one delivery channel (SMS or WhatsApp)');
    }
    return channels;
  }

  const visibleSchedules = useMemo(() => {
    const query = scheduleSearch.trim().toLowerCase();

    return schedules.filter((schedule) => {
      const deptId = schedule.department?._id || schedule.department;
      if (scheduleDepartment && deptId !== scheduleDepartment) return false;
      if (!query) return true;

      const haystack = [schedule.name, schedule.department?.name, schedule.notes]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [schedules, scheduleSearch, scheduleDepartment]);

  async function loadList() {
    const [scheduleData, deptData, memberData, templateData, labelData] = await Promise.all([
      api('/schedules'),
      api('/departments'),
      api('/members'),
      api('/message-templates'),
      api('/assignment-labels'),
    ]);
    setSchedules(scheduleData);
    setDepartments(deptData);
    setMembers(memberData);
    setTemplates(templateData);
    setAssignmentLabels(labelData);
    setCreateForm((prev) => {
      const defaultTpl = defaultScheduleTemplate(templateData);
      const templateId = prev.messageTemplateId || defaultTpl?._id || '';
      return {
        ...prev,
        department: prev.department || deptData[0]?._id || '',
        messageMode: prev.messageMode === 'custom' && !prev.messageTemplateId ? 'custom' : 'template',
        messageTemplateId: templateId ? String(templateId) : '',
        messageBody: prev.messageBody || defaultTpl?.body || '',
      };
    });
  }

  async function loadDetail(scheduleId) {
    const [scheduleData, memberData, deptData, templateData, labelData] = await Promise.all([
      api(`/schedules/${scheduleId}`),
      api('/members'),
      api('/departments'),
      api('/message-templates'),
      api('/assignment-labels'),
    ]);
    setDetail(scheduleData);
    setMembers(memberData);
    setDepartments(deptData);
    setTemplates(templateData);
    setAssignmentLabels(labelData);
    setSettingsForm(scheduleFormFromData(scheduleData, templateData));
  }

  useEffect(() => {
    setError('');
    setUploadIssues([]);
    setUploadWarnings([]);
    if (id) {
      loadDetail(id).catch((err) => setError(err.message));
    } else {
      setDetail(null);
      loadList().catch((err) => setError(err.message));
    }
  }, [id]);

  const deptMembers = useMemo(() => {
    const deptId = detail?.department?._id || detail?.department || createForm.department;
    if (!deptId) return members;
    return members.filter((m) => {
      if (!m.department) return true;
      return m.department?._id === deptId || m.department === deptId;
    });
  }, [members, detail, createForm.department]);

  function buildMessagePayload(form) {
    const messageBody = form.messageBody.trim();
    if (!messageBody) {
      throw new Error('Message text is required');
    }
    if (form.messageMode === 'template' && !form.messageTemplateId) {
      throw new Error('Choose a message template');
    }
    return {
      messageMode: form.messageMode,
      messageTemplateId: form.messageMode === 'template' ? form.messageTemplateId : null,
      messageBody,
    };
  }

  async function onCreateSchedule(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const channels = buildChannelsPayload(createForm);
      const body = {
        name: createForm.name,
        department: createForm.department,
        channels,
        notes: createForm.notes,
        ...buildMessagePayload(createForm),
      };

      if (createForm.addFirstPerson && createForm.member && createForm.date) {
        const roleLabel =
          createForm.roleLabel === NEW_ASSIGNMENT
            ? createForm.customAssignment.trim()
            : createForm.roleLabel;
        body.entries = [
          {
            member: createForm.member,
            date: createForm.date,
            roleLabel: roleLabel || 'Serve',
            notes: createForm.entryNotes,
          },
        ];
      }

      const created = await api('/schedules', { method: 'POST', body });
      setMessage('Schedule created.');
      setCreateForm(emptyCreate);
      navigate(`/schedule/${created._id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function onSaveSettings(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const channels = buildChannelsPayload(settingsForm);
      const body = {
        name: settingsForm.name,
        department: settingsForm.department,
        channels,
        notes: settingsForm.notes,
        ...buildMessagePayload(settingsForm),
      };

      await api(`/schedules/${id}`, {
        method: 'PUT',
        body,
      });
      setMessage('Schedule updated.');
      await loadDetail(id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function onAddEntry(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const roleLabel =
        entryForm.roleLabel === NEW_ASSIGNMENT
          ? entryForm.customAssignment.trim()
          : entryForm.roleLabel.trim();

      if (editingEntryId) {
        await api(`/schedules/${id}/entries/${editingEntryId}`, {
          method: 'PUT',
          body: { ...entryForm, roleLabel },
        });
        setMessage('Entry updated.');
      } else {
        await api(`/schedules/${id}/entries`, {
          method: 'POST',
          body: { ...entryForm, roleLabel },
        });
        setMessage('Person added to schedule.');
      }
      setEntryForm(emptyEntry);
      setEditingEntryId(null);
      await loadDetail(id);
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditEntry(entry) {
    const known = assignmentLabels.some(
      (l) => l.name.toLowerCase() === (entry.roleLabel || '').toLowerCase()
    );
    setEditingEntryId(entry._id);
    setEntryForm({
      member: entry.member?._id || entry.member,
      date: toDateInputValue(entry.date),
      roleLabel: known ? entry.roleLabel : NEW_ASSIGNMENT,
      customAssignment: known ? '' : entry.roleLabel || '',
      notes: entry.notes || '',
    });
  }

  async function removeEntry(entryId) {
    if (!window.confirm('Remove this person from the schedule?')) return;
    await api(`/schedules/${id}/entries/${entryId}`, { method: 'DELETE' });
    if (editingEntryId === entryId) {
      setEditingEntryId(null);
      setEntryForm(emptyEntry);
    }
    await loadDetail(id);
  }

  async function removeSchedule(scheduleId) {
    if (!window.confirm('Delete this entire schedule and all its entries?')) return;
    await api(`/schedules/${scheduleId}`, { method: 'DELETE' });
    navigate('/schedule');
  }

  async function onUpload(e) {
    e.preventDefault();
    if (!file) {
      setError('Choose a CSV file first');
      return;
    }
    setError('');
    setMessage('');
    setUploadIssues([]);
    setUploadWarnings([]);
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await api(`/schedules/${id}/entries/upload`, { method: 'POST', body });
      const created = result.created || 0;
      const issues = result.errors || [];
      const warnings = result.warnings || [];

      if (created > 0) {
        let summary = issues.length
          ? `Added ${created} ${created === 1 ? 'person' : 'people'}. ${issues.length} ${issues.length === 1 ? 'row could' : 'rows could'} not be imported — see details below.`
          : `Added ${created} ${created === 1 ? 'person' : 'people'} to this schedule.`;
        if (warnings.length) {
          summary += ` ${warnings.length} ${warnings.length === 1 ? 'person needs' : 'people need'} a phone number before reminders can be sent.`;
        }
        setMessage(summary);
      } else if (issues.length) {
        setError(
          issues.length === 1
            ? 'Nothing was added — 1 row had a problem.'
            : `Nothing was added — all ${issues.length} rows had problems.`
        );
      } else {
        setError('The file had no rows to import. Check your CSV has a header row and at least one data row.');
      }

      if (issues.length) setUploadIssues(issues);
      if (warnings.length) setUploadWarnings(warnings);
      setFile(null);
      e.target.reset();
      await loadDetail(id);
    } catch (err) {
      setError(err.message);
    }
  }

  if (id && detail) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <Link to="/schedule" className="linkish">
              ← All schedules
            </Link>
            <h1>{detail.name}</h1>
            <p className="muted">
              {detail.department?.name} · {formatChannelsLabel(scheduleChannels(detail))} ·{' '}
              {scheduleMessageLabel(detail)} · {detail.entries?.length || 0} people
            </p>
          </div>
          <button type="button" className="btn danger-ghost" onClick={() => removeSchedule(id)}>
            Delete schedule
          </button>
        </header>

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}

        <section className="panel-grid">
          <form className="panel stack" onSubmit={onSaveSettings}>
            <h2>Schedule settings</h2>
            <label>
              Name
              <input
                value={settingsForm?.name || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                required
              />
            </label>
            <label>
              Department
              <select
                value={settingsForm?.department || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, department: e.target.value })}
                required
              >
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <ChannelDropdown
              sendSms={settingsForm?.sendSms ?? false}
              sendWhatsApp={settingsForm?.sendWhatsApp ?? false}
              onChange={({ sendSms, sendWhatsApp }) =>
                setSettingsForm({ ...settingsForm, sendSms, sendWhatsApp })
              }
            />
            <ScheduleMessageEditor
              mode={settingsForm?.messageMode || 'template'}
              onModeChange={(messageMode) =>
                setSettingsForm((prev) => ({ ...prev, messageMode }))
              }
              templateId={settingsForm?.messageTemplateId || ''}
              onTemplateIdChange={(messageTemplateId) =>
                setSettingsForm((prev) => ({ ...prev, messageTemplateId }))
              }
              messageBody={settingsForm?.messageBody || ''}
              onMessageBodyChange={(messageBody) =>
                setSettingsForm((prev) => ({ ...prev, messageBody }))
              }
              templates={scheduleTemplates}
              scheduleName={settingsForm?.name || ''}
              departmentName={
                departments.find((d) => d._id === settingsForm?.department)?.name || ''
              }
            />
            <label>
              Notes
              <input
                value={settingsForm?.notes || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, notes: e.target.value })}
              />
            </label>
            <button className="btn primary" type="submit">
              Save settings
            </button>
          </form>

          <form className="panel stack" onSubmit={onAddEntry}>
            <h2>{editingEntryId ? 'Edit entry' : 'Add person'}</h2>
            <label>
              Person
              <select
                value={entryForm.member}
                onChange={(e) => setEntryForm({ ...entryForm, member: e.target.value })}
                required
              >
                <option value="" disabled>
                  Select
                </option>
                {deptMembers.map((m) => (
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
                value={entryForm.date}
                onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
                required
              />
            </label>
            <label>
              Assignment
              <select
                value={entryForm.roleLabel}
                onChange={(e) =>
                  setEntryForm({
                    ...entryForm,
                    roleLabel: e.target.value,
                    customAssignment:
                      e.target.value === NEW_ASSIGNMENT ? entryForm.customAssignment : '',
                  })
                }
                required
              >
                <option value="" disabled>
                  Select
                </option>
                {assignmentLabels.map((label) => (
                  <option key={label._id} value={label.name}>
                    {label.name}
                  </option>
                ))}
                <option value={NEW_ASSIGNMENT}>+ Add new assignment</option>
              </select>
            </label>
            {entryForm.roleLabel === NEW_ASSIGNMENT && (
              <label>
                New assignment name
                <input
                  value={entryForm.customAssignment}
                  onChange={(e) => setEntryForm({ ...entryForm, customAssignment: e.target.value })}
                  required
                />
              </label>
            )}
            <label>
              Notes
              <input
                value={entryForm.notes}
                onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
              />
            </label>
            <div className="row-actions">
              <button className="btn primary" type="submit">
                {editingEntryId ? 'Save entry' : 'Add to schedule'}
              </button>
              {editingEntryId && (
                <button
                  type="button"
                  className="linkish"
                  onClick={() => {
                    setEditingEntryId(null);
                    setEntryForm(emptyEntry);
                  }}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>

          <form className="panel stack" onSubmit={onUpload}>
            <h2>Upload CSV</h2>
            <p className="muted small">
              Columns: date, member, assignment, notes. Optional: email, phone (recommended for new people).
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
              Upload to this schedule
            </button>

            {uploadWarnings.length > 0 && (
              <div className="upload-warnings">
                <p className="upload-warnings-title">Missing phone numbers</p>
                <ul className="upload-warnings-list">
                  {uploadWarnings.slice(0, 20).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
                {uploadWarnings.length > 20 && (
                  <p className="muted small">
                    …and {uploadWarnings.length - 20} more people without phone numbers.
                  </p>
                )}
              </div>
            )}

            {uploadIssues.length > 0 && (
              <div className="upload-issues">
                <p className="upload-issues-title">Import details</p>
                <ul className="upload-issues-list">
                  {uploadIssues.slice(0, 20).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
                {uploadIssues.length > 20 && (
                  <p className="muted small">…and {uploadIssues.length - 20} more rows with problems.</p>
                )}
              </div>
            )}
          </form>
        </section>

        <section className="panel">
          <h2>Roster</h2>
          <div className="data-list">
            {(detail.entries || []).map((entry) => (
              <article className="data-card" key={entry._id}>
                <div className="data-card-top">
                  <div>
                    <h3>{entry.member?.name}</h3>
                    <p className="muted small">{formatDate(entry.date)}</p>
                  </div>
                  <div className="data-card-actions">
                    <span className={`pill ${entry.reminderSentAt ? 'ok' : 'warn'}`}>
                      {entry.reminderSentAt ? 'Sent' : 'Pending'}
                    </span>
                    <button type="button" className="btn ghost" onClick={() => startEditEntry(entry)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn danger-ghost"
                      onClick={() => removeEntry(entry._id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <dl className="meta-grid">
                  <div>
                    <dt>Assignment</dt>
                    <dd>{entry.roleLabel || '—'}</dd>
                  </div>
                  <div>
                    <dt>Notes</dt>
                    <dd>{entry.notes || '—'}</dd>
                  </div>
                </dl>
              </article>
            ))}
            {!detail.entries?.length && (
              <p className="empty-state">No people on this schedule yet. Add someone or upload CSV.</p>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Person</th>
                  <th>Assignment</th>
                  <th>Notes</th>
                  <th>Reminder</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(detail.entries || []).map((entry) => (
                  <tr key={entry._id}>
                    <td>{formatDate(entry.date)}</td>
                    <td>{entry.member?.name}</td>
                    <td>{entry.roleLabel}</td>
                    <td>{entry.notes || '—'}</td>
                    <td>
                      <span className={`pill ${entry.reminderSentAt ? 'ok' : 'warn'}`}>
                        {entry.reminderSentAt ? 'Sent' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="btn ghost" onClick={() => startEditEntry(entry)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn danger-ghost"
                          onClick={() => removeEntry(entry._id)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Schedules</h1>
          <p className="muted">
            Create a named roster for a quarter or season. Pick one message template and choose SMS, WhatsApp, or both for delivery.
          </p>
        </div>
      </header>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="panel-grid">
        <form className="panel stack" onSubmit={onCreateSchedule}>
          <h2>Create schedule</h2>
          <label>
            Name
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="Q3 Sunday School"
              required
            />
          </label>
          <label>
            Department
            <select
              value={createForm.department}
              onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
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
          <ChannelDropdown
            sendSms={createForm.sendSms}
            sendWhatsApp={createForm.sendWhatsApp}
            onChange={({ sendSms, sendWhatsApp }) =>
              setCreateForm({ ...createForm, sendSms, sendWhatsApp })
            }
          />
          <ScheduleMessageEditor
            mode={createForm.messageMode}
            onModeChange={(messageMode) =>
              setCreateForm((prev) => ({ ...prev, messageMode }))
            }
            templateId={createForm.messageTemplateId}
            onTemplateIdChange={(messageTemplateId) =>
              setCreateForm((prev) => ({ ...prev, messageTemplateId }))
            }
            messageBody={createForm.messageBody}
            onMessageBodyChange={(messageBody) =>
              setCreateForm((prev) => ({ ...prev, messageBody }))
            }
            templates={scheduleTemplates}
            scheduleName={createForm.name}
            departmentName={
              departments.find((d) => d._id === createForm.department)?.name || ''
            }
          />
          <label>
            Notes
            <input
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={createForm.addFirstPerson}
              onChange={(e) => setCreateForm({ ...createForm, addFirstPerson: e.target.checked })}
            />
            Add a person now (optional)
          </label>

          {createForm.addFirstPerson && (
            <>
              <label>
                Person
                <select
                  value={createForm.member}
                  onChange={(e) => setCreateForm({ ...createForm, member: e.target.value })}
                >
                  <option value="">Select</option>
                  {members
                    .filter((m) => {
                      if (!createForm.department) return true;
                      if (!m.department) return true;
                      return (
                        m.department?._id === createForm.department ||
                        m.department === createForm.department
                      );
                    })
                    .map((m) => (
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
                  value={createForm.date}
                  onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                />
              </label>
              <label>
                Assignment
                <select
                  value={createForm.roleLabel}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      roleLabel: e.target.value,
                      customAssignment:
                        e.target.value === NEW_ASSIGNMENT ? createForm.customAssignment : '',
                    })
                  }
                >
                  <option value="">Select</option>
                  {assignmentLabels.map((label) => (
                    <option key={label._id} value={label.name}>
                      {label.name}
                    </option>
                  ))}
                  <option value={NEW_ASSIGNMENT}>+ Add new</option>
                </select>
              </label>
              {createForm.roleLabel === NEW_ASSIGNMENT && (
                <label>
                  New assignment
                  <input
                    value={createForm.customAssignment}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, customAssignment: e.target.value })
                    }
                  />
                </label>
              )}
            </>
          )}

          <button className="btn primary" type="submit">
            Create schedule
          </button>
        </form>

        <div className="panel">
          <h2>Your schedules</h2>

          <div className="schedule-find-bar">
            <label className="schedule-find-search">
              Find a schedule
              <input
                type="search"
                placeholder="Search by name, department, or notes…"
                value={scheduleSearch}
                onChange={(e) => setScheduleSearch(e.target.value)}
              />
            </label>
            <label>
              Department
              <select
                value={scheduleDepartment}
                onChange={(e) => setScheduleDepartment(e.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(scheduleSearch || scheduleDepartment) && (
            <p className="muted small">
              Showing {visibleSchedules.length} of {schedules.length} schedules ·{' '}
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  setScheduleSearch('');
                  setScheduleDepartment('');
                }}
              >
                Clear
              </button>
            </p>
          )}

          <ul className="schedule-list">
            {visibleSchedules.map((s) => (
              <li key={s._id}>
                <Link to={`/schedule/${s._id}`} className="schedule-card">
                  <strong>{s.name}</strong>
                  <span className="muted small">
                    {s.department?.name} · {formatChannelsLabel(scheduleChannels(s))} ·{' '}
                    {s.entryCount || 0} people
                    {s.dateFrom && s.dateTo
                      ? ` · ${formatDate(s.dateFrom)} – ${formatDate(s.dateTo)}`
                      : ''}
                  </span>
                  <span className="muted small">
                    Message: {scheduleMessageLabel(s)}
                  </span>
                </Link>
              </li>
            ))}
            {!visibleSchedules.length && schedules.length > 0 && (
              <li className="muted empty-state">No schedules match your search.</li>
            )}
            {!schedules.length && (
              <li className="muted empty-state">No schedules yet. Create one to get started.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
