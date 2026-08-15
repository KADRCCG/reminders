import Member from '../models/Member.js';
import { parseAnniversaryPayload, pickAnniversaryFields } from './anniversary.js';
import { parseBirthdayPayload } from './birthday.js';

function emptyToNull(value) {
  if (value === '' || value === undefined) return null;
  return value;
}

export function normalizeMemberPayload(body) {
  const birthday = parseBirthdayPayload(body);
  const anniversary = parseAnniversaryPayload(body);
  return {
    name: body.name,
    email: body.email,
    phone: body.phone ?? '',
    department: emptyToNull(body.department),
    ...birthday,
    ...anniversary,
    spouse: emptyToNull(body.spouse),
    active: body.active,
  };
}

export async function syncSpouseLink(member, previousSpouseId = null) {
  const memberId = member._id.toString();
  const nextSpouseId = member.spouse ? member.spouse.toString() : null;
  const prevId = previousSpouseId ? previousSpouseId.toString() : null;

  if (prevId && prevId !== nextSpouseId) {
    await Member.findByIdAndUpdate(prevId, {
      $set: {
        spouse: null,
        anniversaryMonth: null,
        anniversaryDay: null,
        anniversaryYear: null,
      },
    });
  }

  if (!nextSpouseId) {
    member.spouse = null;
    await member.save();
    return member;
  }

  if (nextSpouseId === memberId) {
    throw new Error('A member cannot be married to themselves');
  }

  const spouse = await Member.findById(nextSpouseId);
  if (!spouse) throw new Error('Spouse not found');

  const oldPartnerId = spouse.spouse ? spouse.spouse.toString() : null;
  if (oldPartnerId && oldPartnerId !== memberId) {
    await Member.findByIdAndUpdate(oldPartnerId, {
      $set: {
        spouse: null,
        anniversaryMonth: null,
        anniversaryDay: null,
        anniversaryYear: null,
      },
    });
  }

  const anniversary =
    member.anniversaryMonth && member.anniversaryDay
      ? pickAnniversaryFields(member)
      : pickAnniversaryFields(spouse);

  member.spouse = spouse._id;
  member.anniversaryMonth = anniversary.anniversaryMonth;
  member.anniversaryDay = anniversary.anniversaryDay;
  member.anniversaryYear = anniversary.anniversaryYear;

  spouse.spouse = member._id;
  spouse.anniversaryMonth = anniversary.anniversaryMonth;
  spouse.anniversaryDay = anniversary.anniversaryDay;
  spouse.anniversaryYear = anniversary.anniversaryYear;

  await Promise.all([member.save(), spouse.save()]);
  return member;
}

export async function clearSpouseOnDelete(member) {
  if (!member?.spouse) return;
  await Member.findByIdAndUpdate(member.spouse, {
    $set: {
      spouse: null,
      anniversaryMonth: null,
      anniversaryDay: null,
      anniversaryYear: null,
    },
  });
}
