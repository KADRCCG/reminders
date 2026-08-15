import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { templateDisplaySubtitle, templateDisplayTitle } from '../utils/templateDisplay';

export default function MessageHub() {
  const [templates, setTemplates] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [draft, setDraft] = useState({ name: '', description: '', body: '' });
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    body: '',
  });

  const selected = useMemo(
    () => templates.find((t) => t.key === selectedKey) || null,
    [templates, selectedKey]
  );

  async function load() {
    const data = await api('/message-templates');
    setTemplates(data);
    setSelectedKey((prev) => prev || data[0]?.key || '');
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDraft({
      name: selected.name || '',
      description: selected.description || '',
      body: selected.body || '',
    });
    setPreview('');
    setMessage('');
    setError('');
  }, [selected?._id, selectedKey]);

  async function refreshPreview(body) {
    if (!selectedKey) return;
    try {
      const result = await api(`/message-templates/${selectedKey}/preview`, {
        method: 'POST',
        body: { body },
      });
      setPreview(result.preview);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (!selectedKey || !draft.body) return;
    const timer = setTimeout(() => {
      refreshPreview(draft.body);
    }, 350);
    return () => clearTimeout(timer);
  }, [selectedKey, draft.body]);

  async function onCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const created = await api('/message-templates', {
        method: 'POST',
        body: createForm,
      });
      await load();
      setSelectedKey(created.key);
      setShowCreate(false);
      setCreateForm({ name: '', description: '', body: '' });
      setMessage('Template created. Use it in schedules or celebrations.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onSave(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await api(`/message-templates/${selectedKey}`, {
        method: 'PUT',
        body: draft,
      });
      setTemplates((prev) => prev.map((t) => (t.key === updated.key ? updated : t)));
      setMessage('Template saved. New reminders and celebrations will use this wording.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (!window.confirm('Reset this template to the default wording?')) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await api(`/message-templates/${selectedKey}/reset`, {
        method: 'POST',
      });
      setTemplates((prev) => prev.map((t) => (t.key === updated.key ? updated : t)));
      setMessage('Template reset to default.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Message hub</h1>
          <p className="muted">
            Edit message templates used for schedules and celebrations. Each template works on SMS and WhatsApp — delivery channel is chosen when sending.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : 'New template'}
        </button>
      </header>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      {showCreate && (
        <form className="panel stack" onSubmit={onCreate}>
          <h2>New template</h2>
          <label>
            Name
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
          </label>
          <label>
            Description
            <input
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            />
          </label>
          <label>
            Message body
            <textarea
              rows={6}
              value={createForm.body}
              onChange={(e) => setCreateForm({ ...createForm, body: e.target.value })}
              placeholder="Hi {{name}}, reminder for {{schedule}} on {{date}}..."
              required
            />
          </label>
          <p className="muted small">
            Use {'{{placeholders}}'} in the body. Schedule templates often use {'{{name}} {{schedule}} {{department}} {{date}} {{assignment}} {{notes_line}}'}.
          </p>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create template'}
          </button>
        </form>
      )}

      <section className="panel-grid message-hub-grid">
        <div className="panel stack">
          <h2>Templates</h2>
          <ul className="template-list">
            {templates.map((tpl) => (
              <li key={tpl.key}>
                <button
                  type="button"
                  className={`template-item${tpl.key === selectedKey ? ' active' : ''}`}
                  onClick={() => setSelectedKey(tpl.key)}
                >
                  <strong>{templateDisplayTitle(tpl)}</strong>
                  {templateDisplaySubtitle(tpl) && (
                    <span className="muted small">{templateDisplaySubtitle(tpl)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {selected && (
          <form className="panel stack" onSubmit={onSave}>
            <h2>Edit template</h2>
            {selected.description ? (
              <p className="muted small">{selected.description}</p>
            ) : null}

            <label>
              Display name
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </label>

            <label>
              Description
              <input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>

            <label>
              Message body
              <textarea
                rows={8}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                required
              />
            </label>

            <p className="muted small">
              Placeholders:{' '}
              {(selected.placeholders || []).map((p) => `{{${p}}}`).join(' · ') || '—'}
            </p>

            <div className="row-actions">
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save template'}
              </button>
              <button type="button" className="linkish" onClick={onReset} disabled={busy}>
                Reset to default
              </button>
            </div>

            <div className="preview-box">
              <h3>Preview</h3>
              <pre>{preview || '…'}</pre>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
