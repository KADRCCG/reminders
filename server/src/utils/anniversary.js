import {
  ANNIVERSARY_KEYS,
  formatPartsLabel,
  getPartsFromMember,
  parseMonthDayYearPayload,
  partsMatch,
  yearsFromParts,
} from './monthDayYear.js';

export function parseAnniversaryPayload(body) {
  return parseMonthDayYearPayload(body, ANNIVERSARY_KEYS);
}

export function getAnniversaryParts(member) {
  return getPartsFromMember(member, ANNIVERSARY_KEYS);
}

export function formatAnniversaryLabel(member) {
  return formatPartsLabel(getAnniversaryParts(member));
}

export function anniversaryYears(member, referenceDate = new Date()) {
  return yearsFromParts(getAnniversaryParts(member), referenceDate);
}

export function anniversaryMatches(member, month, day) {
  return partsMatch(getAnniversaryParts(member), month, day);
}

export function pickAnniversaryFields(source) {
  const parts = getAnniversaryParts(source);
  if (!parts) {
    return {
      anniversaryMonth: null,
      anniversaryDay: null,
      anniversaryYear: null,
    };
  }
  return {
    anniversaryMonth: parts.month,
    anniversaryDay: parts.day,
    anniversaryYear: parts.year,
  };
}
