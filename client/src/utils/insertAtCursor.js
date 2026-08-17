export function insertAtCursor(textareaRef, currentValue, token, onChange) {
  const el = textareaRef.current;
  const start = el?.selectionStart ?? currentValue.length;
  const end = el?.selectionEnd ?? currentValue.length;
  const next = `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`;
  onChange(next);

  requestAnimationFrame(() => {
    if (!el) return;
    el.focus();
    const pos = start + token.length;
    el.setSelectionRange(pos, pos);
  });
}
