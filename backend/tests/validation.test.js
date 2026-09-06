const test = require('node:test');
const assert = require('node:assert');
const { parseId, validateTaskFields, validateChatMessage, validateBoardFields } = require('../src/utils/validation');

test('parseId accepts positive integers', () => {
  assert.strictEqual(parseId('5'), 5);
});

test('parseId rejects non-numeric ids', () => {
  assert.throws(() => parseId('abc'), /invalid task id/);
});

test('parseId rejects zero and negative ids', () => {
  assert.throws(() => parseId('0'));
  assert.throws(() => parseId('-3'));
});

test('parseId uses the given label in its error message', () => {
  assert.throws(() => parseId('abc', 'board'), /invalid board id/);
});

test('validateTaskFields requires a non-empty string title on create', () => {
  assert.throws(() => validateTaskFields({}, { requireTitle: true }), /title is required/);
  assert.throws(() => validateTaskFields({ title: '   ' }, { requireTitle: true }), /title is required/);
  assert.throws(() => validateTaskFields({ title: 123 }, { requireTitle: true }));
});

test('validateTaskFields accepts a valid full payload', () => {
  assert.doesNotThrow(() =>
    validateTaskFields(
      { title: 'Test', priority: 'high', status: 'pending', due_date: '2026-01-01', tags: ['a', 'b'] },
      { requireTitle: true }
    )
  );
});

test('validateTaskFields rejects an invalid priority', () => {
  assert.throws(() => validateTaskFields({ title: 'x', priority: 'urgent' }, { requireTitle: true }), /priority must be one of/);
});

test('validateTaskFields rejects an invalid status', () => {
  assert.throws(() => validateTaskFields({ status: 'archived' }, { requireTitle: false }), /status must be one of/);
});

test('validateTaskFields rejects an invalid due_date', () => {
  assert.throws(() => validateTaskFields({ title: 'x', due_date: 'not-a-date' }, { requireTitle: true }), /due_date must be a valid date/);
});

test('validateTaskFields rejects non-array tags', () => {
  assert.throws(() => validateTaskFields({ title: 'x', tags: 'not-an-array' }, { requireTitle: true }), /tags must be an array/);
});

test('validateTaskFields does not require title when requireTitle is false and title is omitted', () => {
  assert.doesNotThrow(() => validateTaskFields({ status: 'completed' }, { requireTitle: false }));
});

test('validateTaskFields rejects a non-integer or negative position', () => {
  assert.throws(() => validateTaskFields({ position: 'not-a-number' }, { requireTitle: false }), /position must be a non-negative integer/);
  assert.throws(() => validateTaskFields({ position: -1 }, { requireTitle: false }), /position must be a non-negative integer/);
  assert.throws(() => validateTaskFields({ position: 1.5 }, { requireTitle: false }), /position must be a non-negative integer/);
});

test('validateTaskFields rejects a position beyond the Postgres integer range', () => {
  assert.throws(() => validateTaskFields({ position: 99999999999 }, { requireTitle: false }), /position must be a non-negative integer/);
});

test('validateTaskFields accepts a valid position', () => {
  assert.doesNotThrow(() => validateTaskFields({ position: 20 }, { requireTitle: false }));
});

test('validateChatMessage rejects empty or non-string messages', () => {
  assert.throws(() => validateChatMessage(''), /message is required/);
  assert.throws(() => validateChatMessage('   '), /message is required/);
  assert.throws(() => validateChatMessage(undefined), /message is required/);
  assert.throws(() => validateChatMessage(42), /message is required/);
});

test('validateChatMessage rejects messages over 2000 characters', () => {
  assert.throws(() => validateChatMessage('a'.repeat(2001)), /too long/);
});

test('validateChatMessage accepts a normal message', () => {
  assert.doesNotThrow(() => validateChatMessage('cria uma tarefa para amanha'));
});

test('validateBoardFields requires a non-empty string name on create', () => {
  assert.throws(() => validateBoardFields({}, { requireName: true }), /name is required/);
  assert.throws(() => validateBoardFields({ name: '   ' }, { requireName: true }), /name is required/);
  assert.throws(() => validateBoardFields({ name: 123 }, { requireName: true }));
});

test('validateBoardFields does not require name when requireName is false', () => {
  assert.doesNotThrow(() => validateBoardFields({}, { requireName: false }));
});
