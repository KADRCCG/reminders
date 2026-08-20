export function scheduleDepartmentIds(scheduleOrForm) {
  if (Array.isArray(scheduleOrForm?.departments)) {
    return scheduleOrForm.departments.map((dept) => String(dept?._id || dept)).filter(Boolean);
  }
  if (scheduleOrForm?.department) {
    return [String(scheduleOrForm.department?._id || scheduleOrForm.department)];
  }
  return [];
}

export function scheduleDepartmentsLabel(schedule, allDepartments = []) {
  const ids = scheduleDepartmentIds(schedule);
  if (!ids.length) return 'All departments';

  const names = ids
    .map((id) => allDepartments.find((dept) => dept._id === id)?.name)
    .filter(Boolean);

  if (names.length) return names.join(', ');

  const populated = schedule?.departments?.length
    ? schedule.departments
    : schedule?.department
      ? [schedule.department]
      : [];

  const populatedNames = populated.map((dept) => dept?.name).filter(Boolean);
  return populatedNames.length ? populatedNames.join(', ') : 'All departments';
}
