export function memberDepartmentIds(member) {
  if (Array.isArray(member?.departments)) {
    return member.departments.map((dept) => String(dept?._id || dept)).filter(Boolean);
  }
  if (member?.department) {
    return [String(member.department?._id || member.department)];
  }
  return [];
}

export function memberDepartmentsLabel(member, allDepartments = []) {
  const ids = memberDepartmentIds(member);
  if (!ids.length) return '—';

  const names = ids
    .map((id) => allDepartments.find((dept) => dept._id === id)?.name)
    .filter(Boolean);

  if (names.length) return names.join(', ');

  const populated = member?.departments?.length
    ? member.departments
    : member?.department
      ? [member.department]
      : [];

  const populatedNames = populated.map((dept) => dept?.name).filter(Boolean);
  return populatedNames.length ? populatedNames.join(', ') : '—';
}

export function memberMatchesScheduleDepartments(member, scheduleDepartmentIds) {
  if (!scheduleDepartmentIds.length) return true;

  const memberDepts = memberDepartmentIds(member);
  if (!memberDepts.length) return true;

  return memberDepts.some((id) => scheduleDepartmentIds.includes(id));
}
