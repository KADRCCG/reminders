import { useEffect, useState } from 'react';
import { api } from '../api';

const empty = { name: '', description: '' };

export default function Departments() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  async function load() {
    setItems(await api('/departments'));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/departments', {
        method: 'POST',
        body: form,
      });
      setForm(empty);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this department?')) return;
    await api(`/departments/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Departments</h1>
          <p className="muted">Group people by team. Reminder timing is set on each schedule.</p>
        </div>
      </header>

      <section className="panel-grid">
        <form className="panel stack" onSubmit={onSubmit}>
          <h2>Add department</h2>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Sunday School"
              required
            />
          </label>
          <label>
            Description
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Teachers roster"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" type="submit">
            Save department
          </button>
        </form>

        <div className="panel">
          <h2>Active departments</h2>

          <div className="data-list">
            {items.map((dept) => (
              <article className="data-card" key={dept._id}>
                <div className="data-card-top">
                  <div>
                    <h3>{dept.name}</h3>
                    {dept.description && <p className="muted small">{dept.description}</p>}
                  </div>
                  <div className="data-card-actions">
                    <button
                      type="button"
                      className="btn danger-ghost"
                      onClick={() => remove(dept._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!items.length && <p className="empty-state">No departments yet.</p>}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((dept) => (
                  <tr key={dept._id}>
                    <td>
                      <strong>{dept.name}</strong>
                      {dept.description && <div className="muted small">{dept.description}</div>}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn danger-ghost"
                          onClick={() => remove(dept._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={2} className="muted">
                      No departments yet.
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
