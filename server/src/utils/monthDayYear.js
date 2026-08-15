const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function toNullableNumber(value) {
  if (value === '' || value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseMonthDayYearPayload(body, { monthKey, dayKey, yearKey, dateKey, label }) {
  let month = body[monthKey];
  let day = body[dayKey];
  let year = body[yearKey];

  if ((month == null || month === '') && body[dateKey]) {
    const d = new Date(body[dateKey]);
    if (!Number.isNaN(d.getTime())) {
      month = d.getMonth() + 1;
      day = d.getDate();
      year = d.getFullYear();
    }
  }

  month = toNullableNumber(month);
  day = toNullableNumber(day);
  year = toNullableNumber(year);

  if ((month == null) !== (day == null)) {
    throw new Error(`${label} needs both month and day, or leave both empty`);
  }

  if (month != null && (month < 1 || month > 12)) {
    throw new Error(`${label} month must be between 1 and 12`);
  }

  if (day != null && (day < 1 || day > 31)) {
    throw new Error(`${label} day must be between 1 and 31`);
  }

  if (year != null && (year < 1900 || year > 2100)) {
    throw new Error(`${label} year looks invalid`);
  }

  return {
    [monthKey]: month,
    [dayKey]: day,
    [yearKey]: year,
  };
}

export function getPartsFromMember(member, { monthKey, dayKey, yearKey, legacyDateKey }) {
  if (member?.[monthKey] && member?.[dayKey]) {
    return {
      month: member[monthKey],
      day: member[dayKey],
      year: member[yearKey] ?? null,
    };
  }

  if (legacyDateKey && member?.[legacyDateKey]) {
    const d = new Date(member[legacyDateKey]);
    if (!Number.isNaN(d.getTime())) {
      return {
        month: d.getMonth() + 1,
        day: d.getDate(),
        year: d.getFullYear(),
      };
    }
  }

  return null;
}

export function formatPartsLabel(parts) {
  if (!parts) return null;
  const label = `${MONTH_NAMES[parts.month - 1]} ${parts.day}`;
  return parts.year ? `${label}, ${parts.year}` : label;
}

export function yearsFromParts(parts, referenceDate = new Date()) {
  if (!parts?.year) return null;
  let years = referenceDate.getFullYear() - parts.year;
  const before =
    referenceDate.getMonth() + 1 < parts.month ||
    (referenceDate.getMonth() + 1 === parts.month && referenceDate.getDate() < parts.day);
  if (before) years -= 1;
  return years;
}

export function partsMatch(parts, month, day) {
  return Boolean(parts && parts.month === month && parts.day === day);
}

export const BIRTHDAY_KEYS = {
  monthKey: 'birthdayMonth',
  dayKey: 'birthdayDay',
  yearKey: 'birthdayYear',
  dateKey: 'birthday',
  legacyDateKey: 'birthday',
  label: 'Birthday',
};

export const ANNIVERSARY_KEYS = {
  monthKey: 'anniversaryMonth',
  dayKey: 'anniversaryDay',
  yearKey: 'anniversaryYear',
  dateKey: 'weddingAnniversary',
  legacyDateKey: 'weddingAnniversary',
  label: 'Wedding anniversary',
};
