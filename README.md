# RCCG-KAD Workforce Reminders

MERN app that reminds church departments (Sunday School, ushers, choir, etc.) before their scheduled service dates — so the admin does not manually text everyone.

## What it does

- Admin signs in and manages **departments**, **people**, and **schedules**
- Upload a monthly/quarterly schedule via **CSV** (or add one assignment at a time)
- Each department has a **reminder lead time** (default: 2 days before)
- Store member **birthdays** and link **spouses** with a shared **wedding anniversary**
- A daily cron job sends **SMS** service reminders (SMSGate / Android phone) and **WhatsApp** birthday/anniversary announcements (Meta Cloud API)
- If messaging credentials are not configured, messages print to the **server console** (great for local testing)

## Stack

- **MongoDB** + **Express** + **React (Vite)** + **Node.js**
- JWT auth, `node-cron` reminders, Nodemailer email delivery

## Setup

1. Start MongoDB (Docker recommended):

```bash
npm run db:up
```

Or install MongoDB locally / use Atlas and set `MONGODB_URI` in `server/.env`.

2. Install dependencies:

```bash
npm install
npm run install:all
```

3. Copy env if needed:

```bash
copy server\.env.example server\.env
```

4. Seed demo data (optional):

```bash
npm run seed
```

Demo login comes from `server/.env`: `ADMIN_EMAIL` / `ADMIN_PASSWORD` (defaults in `.env.example`).

5. Run API + UI:

```bash
npm run dev
```

- UI: http://localhost:5173  
- API: http://localhost:5000  

## CSV format

### Schedule (`sample-schedule.csv`)

```csv
date,department,member,email,assignment,notes
2026-08-15,Sunday School,Ada Okonkwo,ada@example.com,Teach,Lesson: The Good Samaritan
```

### People (`sample-people.csv`)

```csv
name,email,phone,department,birthdayMonth,birthdayDay,birthdayYear,spouseEmail,anniversaryMonth,anniversaryDay,anniversaryYear
Ada Okonkwo,ada@example.com,08030000001,Sunday School,8,13,,,,,,
```

- Name, email, and phone are required
- Department and years are optional
- `spouseEmail` can be an email or exact name already in the file/directory
- Existing emails are updated; new emails are created
- Unknown departments are created automatically

## Recurring admin workflow

1. Each quarter (or month), upload the new schedule CSV
2. Optionally tweak department reminder days (e.g. Sunday School = 2 days)
3. Leave the server running — reminders send on the cron schedule (`REMINDER_CRON`, default 8:00 AM)

Use **Run reminders now** on the Overview page to test immediately.

## Messaging setup (no Twilio)

### SMS — SMSGate (Android phone gateway)

1. Install [SMSGate](https://sms-gate.app/) on a dedicated Android phone with a working SIM  
2. Enable **Cloud Server** (or Local Server on the same LAN as this API) and copy username/password  
3. In `server/.env`:

```
SMSGATE_BASE_URL=https://api.sms-gate.app/3rdparty/v1
SMSGATE_USERNAME=...
SMSGATE_PASSWORD=...
DEFAULT_PHONE_COUNTRY_CODE=+353
```

Local example: `SMSGATE_BASE_URL=http://192.168.1.50:8080/3rdparty/v1` (confirm path in the phone’s `/docs`).

Schedule reminders → **SMS** to each member’s phone via that SIM.

### WhatsApp — Meta Cloud API

1. Create a Meta WhatsApp Business Cloud API app and phone number  
2. In `server/.env`:

```
META_WHATSAPP_TOKEN=...
META_WHATSAPP_PHONE_NUMBER_ID=...
META_GRAPH_API_VERSION=v21.0
CELEBRATION_WHATSAPP_TO=+35387...,+35387...
```

Optional for cold outbound messages (outside the 24h window): create an approved **utility** template with one body variable, then set:

```
META_WHATSAPP_TEMPLATE_NAME=your_template_name
META_WHATSAPP_TEMPLATE_LANG=en
```

Celebrations → **WhatsApp** to the member (and optional phones in `CELEBRATION_WHATSAPP_TO`).

Without credentials, the app still works; messages are logged in the API terminal.

## Celebrations

On **People**, set phone, birthday, spouse, and wedding anniversary.

Use **Celebrations → Announce today now** to test WhatsApp announcements.
