import Schedule from '../models/Schedule.js';
import Department from '../models/Department.js';

export function getScheduleDepartmentDocs(schedule) {
  if (schedule?.departments?.length) {
    return schedule.departments;
  }
  if (schedule?.department) {
    return [schedule.department];
  }
  return [];
}

export function getScheduleDepartmentIds(schedule) {
  return getScheduleDepartmentDocs(schedule).map((dept) => String(dept._id || dept));
}

export function scheduleDepartmentsLabel(schedule) {
  const names = getScheduleDepartmentDocs(schedule)
    .map((dept) => dept?.name)
    .filter(Boolean);
  return names.length ? names.join(', ') : 'All departments';
}

export async function resolveScheduleDepartments(departmentIds) {
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

export async function migrateLegacyScheduleDepartments() {
  const schedules = await Schedule.collection
    .find({
      department: { $exists: true, $ne: null },
      $or: [{ departments: { $exists: false } }, { departments: { $size: 0 } }],
    })
    .toArray();

  let migrated = 0;
  for (const row of schedules) {
    await Schedule.collection.updateOne(
      { _id: row._id },
      {
        $set: { departments: [row.department] },
        $unset: { department: '' },
      }
    );
    migrated += 1;
  }

  if (migrated) {
    console.log(`[migrate] Moved legacy department field to departments on ${migrated} schedule(s)`);
  }

  return { migrated };
}
