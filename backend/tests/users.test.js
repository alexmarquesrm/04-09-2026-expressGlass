const test = require('node:test');
const assert = require('node:assert');
const pool = require('../src/db/pool');
const authService = require('../src/services/auth.service');
const usersService = require('../src/services/users.service');

function uniqueEmail() {
  return `userstest-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

test('listUsers returns id and name but never email or password_hash', async () => {
  const email = uniqueEmail();
  const created = await authService.createUser({ name: 'Zed Lister', email, password: 'supersecret' });

  const users = await usersService.listUsers();
  const found = users.find((u) => u.id === created.id);
  assert.ok(found);
  assert.strictEqual(found.name, 'Zed Lister');
  assert.strictEqual(found.email, undefined);
  assert.strictEqual(found.password_hash, undefined);

  await pool.query('DELETE FROM users WHERE id = $1', [created.id]);
});

test('listUsers orders users by name', async () => {
  const emailA = uniqueEmail();
  const emailB = uniqueEmail();
  const userZ = await authService.createUser({ name: 'Zzz Sort Test', email: emailA, password: 'supersecret' });
  const userA = await authService.createUser({ name: 'Aaa Sort Test', email: emailB, password: 'supersecret' });

  const users = await usersService.listUsers();
  const indexA = users.findIndex((u) => u.id === userA.id);
  const indexZ = users.findIndex((u) => u.id === userZ.id);
  assert.ok(indexA < indexZ);

  await pool.query('DELETE FROM users WHERE id = ANY($1)', [[userA.id, userZ.id]]);
});

test.after(async () => {
  await pool.end();
});
