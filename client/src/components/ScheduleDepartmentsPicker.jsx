import { useEffect, useMemo, useRef, useState } from 'react';
import { scheduleDepartmentsLabel } from '../utils/scheduleDepartments';

function toggleDepartment(list, id) {
  const normalized = [...new Set(list.map(String))];
  const value = String(id);
  return normalized.includes(value)
    ? normalized.filter((item) => item !== value)
    : [...normalized, value];
}

export default function ScheduleDepartmentsPicker({
  departments,
  selectedIds,
  onChange,
  label = 'Departments',
  optional = true,
  hint = 'Leave empty to allow anyone. Select one or more teams to limit who can be added.',
  emptyMessage = 'No departments yet — add some under Departments.',
  emptySelectionLabel = 'All departments',
  searchPlaceholder = 'Search departments…',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);
  const searchRef = useRef(null);
  const selected = [...new Set((selectedIds || []).map(String))];

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (!wrapRef.current?.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return departments;
    return departments.filter((dept) => dept.name.toLowerCase().includes(query));
  }, [departments, search]);

  const summary = selected.length
    ? scheduleDepartmentsLabel({ departments: selected }, departments)
    : emptySelectionLabel;

  return (
    <div className="departments-dropdown-wrap" ref={wrapRef}>
      <span className="channel-dropdown-label">
        {label}
        {optional && <span className="muted small"> (optional)</span>}
      </span>
      {hint && <p className="muted small departments-dropdown-hint">{hint}</p>}
      <button
        type="button"
        className={`channel-dropdown-trigger${open ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {summary}
      </button>
      {open && (
        <div className="departments-dropdown-menu" role="listbox">
          <label className="departments-dropdown-search">
            <span className="sr-only">Search departments</span>
            <input
              ref={searchRef}
              type="search"
              value={search}
              placeholder={searchPlaceholder}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <div className="departments-dropdown-options">
            {filteredDepartments.map((dept) => (
              <label key={dept._id} className="channel-dropdown-option">
                <input
                  type="checkbox"
                  checked={selected.includes(String(dept._id))}
                  onChange={() => onChange(toggleDepartment(selected, dept._id))}
                />
                {dept.name}
              </label>
            ))}
            {!departments.length && <p className="muted small">{emptyMessage}</p>}
            {departments.length > 0 && !filteredDepartments.length && (
              <p className="muted small">No departments match your search.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
