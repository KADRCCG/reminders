import Assignment from '../models/Assignment.js';
import AssignmentLabel from '../models/AssignmentLabel.js';

export async function ensureAssignmentLabel(rawName) {
  const name = String(rawName || '').trim();
  if (!name) return null;

  const existing = await AssignmentLabel.findOne({
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });

  if (existing) {
    // Keep original casing of first saved label
    return existing;
  }

  return AssignmentLabel.create({ name });
}

/** Pull distinct roleLabels from existing assignments into the dropdown catalog. */
export async function backfillAssignmentLabels() {
  const labels = await Assignment.distinct('roleLabel');
  await Promise.all(labels.map((name) => ensureAssignmentLabel(name)));
}
