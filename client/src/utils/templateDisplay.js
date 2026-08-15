export function humanizeCustomTemplateKey(key) {
  let s = String(key || '').replace(/^custom_/, '');
  s = s.replace(/_[a-z0-9]{5,12}$/i, '');
  s = s.replace(/_/g, ' ').trim();
  if (!s) return 'Custom template';
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isFriendlyTemplateName(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  if (/^custom_[a-z0-9_]+$/i.test(n)) return false;
  if (n.includes(' ')) return true;
  if (n.length >= 10) return true;
  if (/^[A-Z]/.test(n)) return true;
  return false;
}

export function templateDisplayTitle(tpl) {
  if (!tpl) return '';
  if (tpl.kind === 'custom' && !isFriendlyTemplateName(tpl.name)) {
    return humanizeCustomTemplateKey(tpl.key);
  }
  return tpl.name || humanizeCustomTemplateKey(tpl.key);
}

export function templateDisplaySubtitle(tpl) {
  if (!tpl) return '';
  if (tpl.description?.trim()) return tpl.description.trim();
  if (tpl.kind === 'custom') return 'Custom template';
  return '';
}
