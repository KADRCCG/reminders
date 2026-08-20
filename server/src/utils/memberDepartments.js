import Member from '../models/Member.js';
import Department from '../models/Department.js';

export function getMemberDepartmentDocs(member) {
  if (member?.departments?.length) {
    return member.departments;
  }
  if (member?.department) {
    return [member.department];
  }
  return [];
}

export function getMemberDepartmentIds(member) {
  return getMemberDepartmentDocs(member).map((dept) => String(dept._id || dept));
}

export function memberDepartmentsLabel(member) {
  const names = getMemberDepartmentDocs(member)
    .map((dept) => dept?.name)
    .filter(Boolean);
  return names.length ? names.join(', ') : '';
}

export async function resolveMemberDepartments(departmentIds) {
  const ids = [
    ...new Set(
      (Array.isArray(departmentIds) ? departmentIds : departmentIds ? [departmentIds] : [])
        .filter(Boolean)
        .map((id) => String(id))
    ),
  ];

  for (const id of ids) {
    const dept = await Department.findById(id);
    if (!dept) throw new Error('Department not found');
  }

  return ids;
}

export function parseDepartmentsFromBody(body) {
  if (Array.isArray(body?.departments)) {
    return [...new Set(body.departments.filter(Boolean).map((id) => String(id)))];
  }
  if (body?.department !== undefined) {
    return body.department ? [String(body.department)] : [];
  }
  return undefined;
}

export async function resolveDepartmentNamesList(namesString, findOrCreateDepartment) {
  const names = String(namesString || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const ids = [];
  for (const name of names) {
    const department = await findOrCreateDepartment(name);
    if (department?._id) ids.push(String(department._id));
  }

  return [...new Set(ids)];
}

export async function migrateLegacyMemberDepartments() {
  const members = await Member.collection
    .find({
      department: { $exists: true, $ne: null },
      $or: [{ departments: { $exists: false } }, { departments: { $size: 0 } }],
    })
    .toArray();

  let migrated = 0;
  for (const row of members) {
    await Member.collection.updateOne(
      { _id: row._id },
      {
        $set: { departments: [row.department] },
        $unset: { department: '' },
      }
    );
    migrated += 1;
  }

  if (migrated) {
    console.log(`[migrate] Moved legacy department field to departments on ${migrated} member(s)`);
  }

  return { migrated };
}
