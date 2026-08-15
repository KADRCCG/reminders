import {
  BIRTHDAY_KEYS,
  formatPartsLabel,
  getPartsFromMember,
  parseMonthDayYearPayload,
  partsMatch,
  yearsFromParts,
} from './monthDayYear.js';

export function parseBirthdayPayload(body) {
  return parseMonthDayYearPayload(body, BIRTHDAY_KEYS);
}

export function getBirthdayParts(member) {
  return getPartsFromMember(member, BIRTHDAY_KEYS);
}

export function formatBirthdayLabel(member) {
  return formatPartsLabel(getBirthdayParts(member));
}

export function birthdayAge(member, referenceDate = new Date()) {
  return yearsFromParts(getBirthdayParts(member), referenceDate);
}

export function birthdayMatches(member, month, day) {
  return partsMatch(getBirthdayParts(member), month, day);
}
