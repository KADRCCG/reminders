import { normalizePhone } from '../utils/phone.js';

function logFallback(channel, to, body) {
  console.log(`\n--- ${channel.toUpperCase()} (console fallback) ---`);
  console.log(`To: ${to}`);
  console.log(body);
  console.log('----------------------------------------\n');
  return { channel: 'console', sid: 'console' };
}

function basicAuthHeader(username, password) {
  const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

function smsGateConfigured() {
  return Boolean(
    String(process.env.SMSGATE_USERNAME || '').trim() &&
      String(process.env.SMSGATE_PASSWORD || '').trim()
  );
}

function smsGateBaseUrl() {
  const raw =
    String(process.env.SMSGATE_BASE_URL || 'https://api.sms-gate.app/3rdparty/v1').trim() ||
    'https://api.sms-gate.app/3rdparty/v1';
  const base = raw.replace(/\/+$/, '');

  // /mobile/v1 is only for the Android app talking to SMSGate cloud — not for our server.
  if (/\/mobile(\/|$)/i.test(base)) {
    throw new Error(
      'SMSGATE_BASE_URL must be the 3rd-party API (…/3rdparty/v1), not …/mobile/v1 (that path is for the phone app only)'
    );
  }

  return base;
}

function smsGateAuth() {
  const username = String(process.env.SMSGATE_USERNAME || '').trim();
  const password = String(process.env.SMSGATE_PASSWORD || '');
  return {
    username,
    password,
    header: basicAuthHeader(username, password),
  };
}

async function readErrorMessage(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return (
      json?.error?.message ||
      json?.message ||
      json?.error ||
      json?.reason ||
      (typeof json === 'string' ? json : text) ||
      res.statusText
    );
  } catch {
    return text || res.statusText;
  }
}

async function fetchSmsGateMessage(id) {
  const { header } = smsGateAuth();
  const res = await fetch(`${smsGateBaseUrl()}/messages/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { Authorization: header },
  });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send SMS via SMSGate (Android phone gateway).
 * Docs: https://docs.sms-gate.app/ — use Cloud/Local 3rd-party API, not /mobile/v1.
 */
export async function sendSms({ to, body }) {
  const phone = normalizePhone(to);
  if (!phone) {
    throw new Error('Member phone number is missing or invalid for SMS');
  }

  if (!smsGateConfigured()) {
    return logFallback('sms', phone, body);
  }

  const { header } = smsGateAuth();
  const url = `${smsGateBaseUrl()}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: header,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      textMessage: { text: body },
      phoneNumbers: [phone],
      withDeliveryReport: true,
    }),
  });

  if (!res.ok) {
    const detail = await readErrorMessage(res);
    throw new Error(`SMSGate SMS failed (${res.status}): ${detail}`);
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  const sid = data.id || data.messageId || data.uuid || 'smsgate';
  let state = data.state || 'Pending';

  // Cloud accepts the message immediately as Pending; phone must be Online to send.
  for (let i = 0; i < 4; i += 1) {
    await sleep(1500);
    const latest = await fetchSmsGateMessage(sid);
    if (!latest) break;
    state = latest.state || state;
    if (['Sent', 'Delivered', 'Failed', 'Cancelled'].includes(state)) {
      if (latest.reason) data.reason = latest.reason;
      break;
    }
  }

  if (state === 'Failed') {
    throw new Error(
      `SMSGate reported Failed for ${phone}${data.reason ? `: ${data.reason}` : ''} (id ${sid})`
    );
  }

  if (state === 'Pending' || state === 'Processed') {
    console.warn(
      `[SMSGate] Message ${sid} is ${state} — accepted by cloud, waiting on Android device. ` +
        `Keep SMSGate Cloud Online, phone charged, and check the app’s message list.`
    );
  }

  return {
    channel: 'sms',
    sid,
    state,
    to: phone,
  };
}

function metaWhatsAppConfigured() {
  return Boolean(
    String(process.env.META_WHATSAPP_TOKEN || '').trim() &&
      String(process.env.META_WHATSAPP_PHONE_NUMBER_ID || '').trim()
  );
}

function metaDigits(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return normalized.replace(/\D/g, '');
}

/**
 * Send WhatsApp via Meta Cloud API (not Twilio).
 * Free-form text works inside the 24h customer-care window;
 * for cold outreach Meta requires an approved template (set META_WHATSAPP_TEMPLATE_NAME).
 */
export async function sendWhatsApp({ to, body }) {
  const phone = normalizePhone(to);
  if (!phone) {
    throw new Error('Phone number is missing or invalid for WhatsApp');
  }

  if (!metaWhatsAppConfigured()) {
    return logFallback('whatsapp', phone, body);
  }

  const token = String(process.env.META_WHATSAPP_TOKEN).trim();
  const phoneNumberId = String(process.env.META_WHATSAPP_PHONE_NUMBER_ID).trim();
  const version = String(process.env.META_GRAPH_API_VERSION || 'v21.0').trim() || 'v21.0';
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const toDigits = metaDigits(phone);

  const templateName = String(process.env.META_WHATSAPP_TEMPLATE_NAME || '').trim();
  const templateLang = String(process.env.META_WHATSAPP_TEMPLATE_LANG || 'en').trim() || 'en';

  let payload;
  if (templateName) {
    payload = {
      messaging_product: 'whatsapp',
      to: toDigits,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLang },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: body }],
          },
        ],
      },
    };
  } else {
    payload = {
      messaging_product: 'whatsapp',
      to: toDigits,
      type: 'text',
      text: { preview_url: false, body },
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await readErrorMessage(res);
    throw new Error(`Meta WhatsApp failed (${res.status}): ${detail}`);
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  const sid = data?.messages?.[0]?.id || 'meta-whatsapp';
  return { channel: 'whatsapp', sid };
}
