const test = require('node:test');
const assert = require('node:assert');
const { parseId, validateTaskFields } = require('../src/utils/validation');

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
