const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['pending', 'completed'];

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function parseId(rawId, label = 'task') {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest(`invalid ${label} id: "${rawId}"`);
  }
  return id;
}

function validateTaskFields({ title, description, status, priority, due_date, tags, position, assignee_id, column_id }, { requireTitle }) {
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
  if (position !== undefined && (!Number.isInteger(position) || position < 0 || position > 1_000_000_000)) {
    throw badRequest('position must be a non-negative integer no greater than 1000000000');
  }
  if (assignee_id !== undefined && assignee_id !== null && (!Number.isInteger(assignee_id) || assignee_id <= 0)) {
    throw badRequest('assignee_id must be a positive integer or null');
  }
  // No null here, unlike assignee_id: a card always lives in a column, so an
  // explicit null is a mistake rather than a way to clear the field.
  if (column_id !== undefined && (!Number.isInteger(column_id) || column_id <= 0)) {
    throw badRequest('column_id must be a positive integer');
  }
}

function validateColumnFields({ name, position }, { requireName }) {
  if (requireName && (typeof name !== 'string' || !name.trim())) {
    throw badRequest('name is required and must be a non-empty string');
  }
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    throw badRequest('name must be a non-empty string');
  }
  if (name !== undefined && name.length > 60) {
    throw badRequest('name is too long (max 60 characters)');
  }
  if (position !== undefined && (!Number.isInteger(position) || position < 0 || position > 1_000_000_000)) {
    throw badRequest('position must be a non-negative integer no greater than 1000000000');
  }
}

function validateChatMessage(message) {
  if (typeof message !== 'string' || !message.trim()) {
    throw badRequest('message is required and must be a non-empty string');
  }
  if (message.length > 2000) {
    throw badRequest('message is too long (max 2000 characters)');
  }
}

function validateConfirmationToken(token) {
  if (typeof token !== 'string' || !token.trim()) {
    throw badRequest('confirmation_token is required and must be a non-empty string');
  }
  return token;
}

function validateBoardFields({ name }, { requireName }) {
  if (requireName && (typeof name !== 'string' || !name.trim())) {
    throw badRequest('name is required and must be a non-empty string');
  }
  if (name !== undefined && typeof name !== 'string') {
    throw badRequest('name must be a string');
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegisterFields({ name, email, password }) {
  if (typeof name !== 'string' || !name.trim()) {
    throw badRequest('name is required and must be a non-empty string');
  }
  // Names are shown to the chat assistant (member/user pickers), so an
  // unbounded name field is a place to park a wall of instruction-shaped text.
  if (name.length > 80) {
    throw badRequest('name is too long (max 80 characters)');
  }
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email)) {
    throw badRequest('email must be a valid email address');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw badRequest('password must be at least 8 characters');
  }
}

const BOARD_ROLES = ['owner', 'member'];

function validateMemberFields({ user_id, role }) {
  if (!Number.isInteger(user_id) || user_id <= 0) {
    throw badRequest('user_id is required and must be a positive integer');
  }
  if (role !== undefined && !BOARD_ROLES.includes(role)) {
    throw badRequest(`role must be one of: ${BOARD_ROLES.join(', ')}`);
  }
}

function validateLoginFields({ email, password }) {
  if (typeof email !== 'string' || !email.trim()) {
    throw badRequest('email is required');
  }
  if (typeof password !== 'string' || !password) {
    throw badRequest('password is required');
  }
}

module.exports = {
  parseId,
  validateTaskFields,
  validateChatMessage,
  validateConfirmationToken,
  validateBoardFields,
  validateColumnFields,
  validateRegisterFields,
  validateLoginFields,
  validateMemberFields,
  badRequest,
};
