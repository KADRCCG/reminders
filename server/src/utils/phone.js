/**
 * Normalize a phone number to E.164 when possible.
 * Uses DEFAULT_PHONE_COUNTRY_CODE (e.g. +234) for local numbers like 0803...
 */
export function normalizePhone(raw, defaultCountryCode = process.env.DEFAULT_PHONE_COUNTRY_CODE || '+234') {
  if (!raw) return null;
  let value = String(raw).trim();
  if (!value) return null;

  value = value.replace(/[^\d+]/g, '');

  if (value.startsWith('00')) {
    value = `+${value.slice(2)}`;
  }

  if (value.startsWith('+')) {
    const digits = value.slice(1).replace(/\D/g, '');
    return digits ? `+${digits}` : null;
  }

  const digits = value.replace(/\D/g, '');
  if (!digits) return null;

  const cc = String(defaultCountryCode || '+234').replace(/[^\d+]/g, '');
  const ccDigits = cc.startsWith('+') ? cc.slice(1) : cc;

  if (digits.startsWith(ccDigits)) {
    return `+${digits}`;
  }

  // Local Nigerian-style numbers often start with 0
  const national = digits.startsWith('0') ? digits.slice(1) : digits;
  return `+${ccDigits}${national}`;
}

export function toWhatsAppAddress(phone) {
  const normalized = normalizePhone(phone);
  return normalized ? `whatsapp:${normalized}` : null;
}
