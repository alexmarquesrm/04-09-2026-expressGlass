const test = require('node:test');
const assert = require('node:assert');
const pool = require('../src/db/pool');
const authService = require('../src/services/auth.service');

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

test('createUser hashes the password and never stores it in plain text', async () => {
  const email = uniqueEmail();
  const user = await authService.createUser({ name: 'Ana', email, password: 'supersecret' });
  assert.strictEqual(user.name, 'Ana');
  assert.strictEqual(user.email, email);
  assert.strictEqual(user.password_hash, undefined);

  const stored = await authService.findUserByEmail(email);
  assert.notStrictEqual(stored.password_hash, 'supersecret');
});

test('findUserByEmail is case-insensitive', async () => {
  const email = uniqueEmail();
  await authService.createUser({ name: 'Bea', email, password: 'supersecret' });
  const found = await authService.findUserByEmail(email.toUpperCase());
  assert.ok(found);
  assert.strictEqual(found.email, email.toLowerCase());
});

test('verifyPassword accepts the correct password and rejects a wrong one', async () => {
  const email = uniqueEmail();
  await authService.createUser({ name: 'Cat', email, password: 'correct-password' });
  const user = await authService.findUserByEmail(email);

  assert.strictEqual(await authService.verifyPassword(user, 'correct-password'), true);
  assert.strictEqual(await authService.verifyPassword(user, 'wrong-password'), false);
});

test('signToken/verifyToken round-trip the user id', async () => {
  const email = uniqueEmail();
  const user = await authService.createUser({ name: 'Dan', email, password: 'supersecret' });
  const token = authService.signToken(user);
  const payload = authService.verifyToken(token);
  assert.strictEqual(payload.sub, user.id);
});

test('findUserById never returns the password hash', async () => {
  const email = uniqueEmail();
  const created = await authService.createUser({ name: 'Eve', email, password: 'supersecret' });
  const found = await authService.findUserById(created.id);
  assert.strictEqual(found.password_hash, undefined);
});

test('creating a second user with the same email is rejected with a 409, not a raw DB error', async () => {
  const email = uniqueEmail();
  await authService.createUser({ name: 'Fay', email, password: 'supersecret' });
  await assert.rejects(
    () => authService.createUser({ name: 'Fay 2', email, password: 'supersecret' }),
    (err) => err.status === 409 && /already registered/.test(err.message)
  );
});

test('two concurrent createUser calls for the same email: one succeeds, the other gets a clean 409', async () => {
  const email = uniqueEmail();
  const results = await Promise.allSettled([
    authService.createUser({ name: 'Race 1', email, password: 'supersecret' }),
    authService.createUser({ name: 'Race 2', email, password: 'supersecret' }),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  assert.strictEqual(fulfilled.length, 1);
  assert.strictEqual(rejected.length, 1);
  assert.strictEqual(rejected[0].reason.status, 409);
  assert.match(rejected[0].reason.message, /already registered/);
});

test.after(async () => {
  await pool.end();
});
