import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import PlaceholderChips from './PlaceholderChips';
import { templateDisplayTitle } from '../utils/templateDisplay';
import { insertAtCursor } from '../utils/insertAtCursor';
import {
  renderTemplate,
  SCHEDULE_MESSAGE_PLACEHOLDERS,
  SCHEDULE_SAMPLE_VARS,
} from '../utils/renderTemplate';

export const CUSTOM_MESSAGE_VALUE = '__custom__';

export default function ScheduleMessageEditor({
  mode,
  onModeChange,
  templateId,
  onTemplateIdChange,
  messageBody,
  onMessageBodyChange,
  templates,
  scheduleName = '',
  departmentName = '',
}) {
  const textareaRef = useRef(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => String(t._id) === String(templateId || '')) || null,
    [templates, templateId]
  );

  const previewVars = useMemo(
    () => ({
      ...SCHEDULE_SAMPLE_VARS,
      schedule: scheduleName.trim() || SCHEDULE_SAMPLE_VARS.schedule,
      department: departmentName.trim() || SCHEDULE_SAMPLE_VARS.department,
    }),
    [scheduleName, departmentName]
  );

  const preview = useMemo(
    () => renderTemplate(messageBody, previewVars),
    [messageBody, previewVars]
  );

  const templateBody = selectedTemplate?.body || '';
  const bodyDiffersFromTemplate =
    mode === 'template' && templateBody && messageBody.trim() !== templateBody.trim();

  const selectValue =
    mode === 'custom'
      ? CUSTOM_MESSAGE_VALUE
      : templates.some((t) => String(t._id) === String(templateId || ''))
        ? String(templateId)
        : '';

  function onSelectMessageSource(value) {
    if (value === CUSTOM_MESSAGE_VALUE) {
      onModeChange('custom');
      onTemplateIdChange('');
      onMessageBodyChange('');
      return;
    }

    onModeChange('template');
    onTemplateIdChange(value);
    const tpl = templates.find((t) => String(t._id) === value);
    if (tpl?.body) onMessageBodyChange(tpl.body);
  }

  return (
    <div className="schedule-message-editor stack">
      <label>
        Message template
        <select
          value={selectValue}
          onChange={(e) => onSelectMessageSource(e.target.value)}
          required
        >
          <option value="" disabled>
            Select template
          </option>
          {templates.map((t) => (
            <option key={t._id} value={String(t._id)}>
              {templateDisplayTitle(t)}
            </option>
          ))}
          <option value={CUSTOM_MESSAGE_VALUE}>Write a custom message</option>
        </select>
      </label>

      <label>
        {mode === 'template' ? 'Message (edit for this schedule only)' : 'Custom message'}
        <textarea
          ref={textareaRef}
          rows={6}
          value={messageBody}
          onChange={(e) => onMessageBodyChange(e.target.value)}
          placeholder="Hi {{name}}, reminder: you are on {{schedule}} for {{department}} on {{date}}..."
          required
        />
      </label>

      <PlaceholderChips
        placeholders={SCHEDULE_MESSAGE_PLACEHOLDERS}
        onInsert={(key) =>
          insertAtCursor(textareaRef, messageBody, `{{${key}}}`, onMessageBodyChange)
        }
      />

      <p className="muted small">
        Changes here apply only to this schedule —{' '}
        {mode === 'template' ? (
          <>
            the Message Hub template is unchanged. Edit shared templates in{' '}
            <Link to="/messages" className="linkish">
              Message Hub
            </Link>
            .
          </>
        ) : (
          'this message is not saved as a reusable template.'
        )}
      </p>

      {mode === 'template' && bodyDiffersFromTemplate && (
        <button
          type="button"
          className="linkish"
          onClick={() => onMessageBodyChange(templateBody)}
        >
          Reset to template wording
        </button>
      )}

      <div className="preview-box">
        <h3>Preview (sample data)</h3>
        <pre>{preview || 'Enter message text above to see a preview.'}</pre>
      </div>
    </div>
  );
}
