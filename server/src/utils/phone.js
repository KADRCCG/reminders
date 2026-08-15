/**
 * Normalize a phone number to E.164 when possible.
 * Uses DEFAULT_PHONE_COUNTRY_CODE (e.g. +353) for local numbers like 087...
 */
export function normalizePhone(raw, defaultCountryCode = process.env.DEFAULT_PHONE_COUNTRY_CODE || '+353') {
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

  const cc = String(defaultCountryCode || '+353').replace(/[^\d+]/g, '');
  const ccDigits = cc.startsWith('+') ? cc.slice(1) : cc;

  if (digits.startsWith(ccDigits)) {
    return `+${digits}`;
  }

  // Local numbers often start with 0 (e.g. 087... in Ireland)
  const national = digits.startsWith('0') ? digits.slice(1) : digits;
  return `+${ccDigits}${national}`;
}

export function toWhatsAppAddress(phone) {
  const normalized = normalizePhone(phone);
  return normalized ? `whatsapp:${normalized}` : null;
}
