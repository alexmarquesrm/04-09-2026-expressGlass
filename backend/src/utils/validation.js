const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['pending', 'completed'];

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function parseId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest(`invalid task id: "${rawId}"`);
  }
  return id;
}

function validateTaskFields({ title, description, status, priority, due_date, tags }, { requireTitle }) {
  if (requireTitle && (typeof title !== 'string' || !title.trim())) {
    throw badRequest('title is required and must be a non-empty string');
  }
  if (title !== undefined && typeof title !== 'string') {
    throw badRequest('title must be a string');
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    throw badRequest('description must be a string');
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    throw badRequest(`status must be one of: ${STATUSES.join(', ')}`);
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    throw badRequest(`priority must be one of: ${PRIORITIES.join(', ')}`);
  }
  if (due_date !== undefined && due_date !== null && Number.isNaN(Date.parse(due_date))) {
    throw badRequest('due_date must be a valid date string');
  }
  if (tags !== undefined && (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string'))) {
    throw badRequest('tags must be an array of strings');
  }
}

module.exports = { parseId, validateTaskFields, badRequest };
