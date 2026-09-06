const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/db/pool');

function uniqueEmail(label) {
  return `accesstest-${label.replace(/\s+/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerAndLogin(label) {
  const agent = request.agent(app);
  const email = uniqueEmail(label);
  const res = await agent.post('/api/auth/register').send({ name: label, email, password: 'password123' });
  return { agent, userId: res.body.id, email };
}

let owner;
let outsider;

test.before(async () => {
  owner = await registerAndLogin('Access Owner');
  outsider = await registerAndLogin('Access Outsider');
});

test('POST/GET /api/boards both 401 with no auth cookie at all', async () => {
  await request(app).post('/api/boards').send({ name: 'Nope' }).expect(401);
  await request(app).get('/api/boards').expect(401);
});

test('creating a board makes the creator the owner, and it appears in their list but not a stranger\'s', async () => {
  const created = await owner.agent.post('/api/boards').send({ name: 'Access Board A' }).expect(201);
  assert.strictEqual(created.body.my_role, 'owner');

  const ownerList = await owner.agent.get('/api/boards').expect(200);
  assert.ok(ownerList.body.some((b) => b.id === created.body.id));

  const outsiderList = await outsider.agent.get('/api/boards').expect(200);
  assert.ok(!outsiderList.body.some((b) => b.id === created.body.id));

  await owner.agent.delete(`/api/boards/${created.body.id}`).expect(204);
});

test('a non-member gets 403 (not 404) on a real board, and 404 on a nonexistent one', async () => {
  const created = await owner.agent.post('/api/boards').send({ name: 'Access Board B' }).expect(201);

  await outsider.agent.get(`/api/boards/${created.body.id}`).expect(403);
  await outsider.agent.get(`/api/boards/${created.body.id}/tasks`).expect(403);
  await outsider.agent.post(`/api/boards/${created.body.id}/tasks`).send({ title: 'sneaky' }).expect(403);
  await outsider.agent.get('/api/boards/999999').expect(404);

  await owner.agent.delete(`/api/boards/${created.body.id}`).expect(204);
});

test('a member can read/write tasks and view members, but cannot edit the board or manage members', async () => {
  const created = await owner.agent.post('/api/boards').send({ name: 'Access Board C' }).expect(201);
  const boardId = created.body.id;

  await owner.agent.post(`/api/boards/${boardId}/members`).send({ user_id: outsider.userId }).expect(201);

  await outsider.agent.get(`/api/boards/${boardId}`).expect(200);
  await outsider.agent.get(`/api/boards/${boardId}/tasks`).expect(200);
  const task = await outsider.agent.post(`/api/boards/${boardId}/tasks`).send({ title: 'member task' }).expect(201);
  await outsider.agent.patch(`/api/boards/${boardId}/tasks/${task.body.id}`).send({ status: 'completed' }).expect(200);
  await outsider.agent.delete(`/api/boards/${boardId}/tasks/${task.body.id}`).expect(204);
  await outsider.agent.get(`/api/boards/${boardId}/members`).expect(200);

  await outsider.agent.patch(`/api/boards/${boardId}`).send({ name: 'Renamed by member' }).expect(403);
  await outsider.agent.delete(`/api/boards/${boardId}`).expect(403);
  await outsider.agent.post(`/api/boards/${boardId}/members`).send({ user_id: outsider.userId, role: 'owner' }).expect(403);
  await outsider.agent.delete(`/api/boards/${boardId}/members/${owner.userId}`).expect(403);

  await owner.agent.delete(`/api/boards/${boardId}`).expect(204);
});

test('removing a member revokes their access immediately', async () => {
  const created = await owner.agent.post('/api/boards').send({ name: 'Access Board D' }).expect(201);
  const boardId = created.body.id;

  await owner.agent.post(`/api/boards/${boardId}/members`).send({ user_id: outsider.userId }).expect(201);
  await outsider.agent.get(`/api/boards/${boardId}`).expect(200);

  await owner.agent.delete(`/api/boards/${boardId}/members/${outsider.userId}`).expect(204);
  await outsider.agent.get(`/api/boards/${boardId}`).expect(403);

  await owner.agent.delete(`/api/boards/${boardId}`).expect(204);
});

test('cannot remove the board\'s only owner via DELETE /members', async () => {
  const created = await owner.agent.post('/api/boards').send({ name: 'Access Board E' }).expect(201);
  const boardId = created.body.id;

  const res = await owner.agent.delete(`/api/boards/${boardId}/members/${owner.userId}`).expect(400);
  assert.match(res.body.error, /only owner/);

  await owner.agent.delete(`/api/boards/${boardId}`).expect(204);
});

test('cannot demote the board\'s only owner to member via POST /members either (the bug QA caught)', async () => {
  const created = await owner.agent.post('/api/boards').send({ name: 'Access Board F' }).expect(201);
  const boardId = created.body.id;

  const res = await owner.agent.post(`/api/boards/${boardId}/members`).send({ user_id: owner.userId, role: 'member' }).expect(400);
  assert.match(res.body.error, /only owner/);

  // confirm the owner is still actually an owner and the board is still manageable
  await owner.agent.patch(`/api/boards/${boardId}`).send({ name: 'Still owned' }).expect(200);
  await owner.agent.delete(`/api/boards/${boardId}`).expect(204);
});

test('with two owners, demoting one is allowed, but demoting the last remaining owner is blocked', async () => {
  const created = await owner.agent.post('/api/boards').send({ name: 'Access Board G' }).expect(201);
  const boardId = created.body.id;

  await owner.agent.post(`/api/boards/${boardId}/members`).send({ user_id: outsider.userId, role: 'owner' }).expect(201);
  await owner.agent.post(`/api/boards/${boardId}/members`).send({ user_id: owner.userId, role: 'member' }).expect(201);

  // now outsider is the sole owner; demoting them too must be blocked
  const res = await outsider.agent.post(`/api/boards/${boardId}/members`).send({ user_id: outsider.userId, role: 'member' }).expect(400);
  assert.match(res.body.error, /only owner/);

  await outsider.agent.delete(`/api/boards/${boardId}`).expect(204);
});

test('column routes: a non-member is refused, a member can shape the board, only the owner can delete a column', async () => {
  const created = await owner.agent.post('/api/boards').send({ name: 'Access Board H' }).expect(201);
  const boardId = created.body.id;

  // a fresh board already has its default columns
  const columns = await owner.agent.get(`/api/boards/${boardId}/columns`).expect(200);
  assert.strictEqual(columns.body.length, 3);

  // a stranger sees none of it
  await outsider.agent.get(`/api/boards/${boardId}/columns`).expect(403);
  await outsider.agent.post(`/api/boards/${boardId}/columns`).send({ name: 'sneaky' }).expect(403);

  // a member can add and rename columns...
  await owner.agent.post(`/api/boards/${boardId}/members`).send({ user_id: outsider.userId }).expect(201);
  const added = await outsider.agent.post(`/api/boards/${boardId}/columns`).send({ name: 'Em revisão' }).expect(201);
  const renamed = await outsider.agent
    .patch(`/api/boards/${boardId}/columns/${added.body.id}`)
    .send({ name: 'A rever' })
    .expect(200);
  assert.strictEqual(renamed.body.name, 'A rever');

  // ...but deleting one is owner-only
  await outsider.agent.delete(`/api/boards/${boardId}/columns/${added.body.id}`).expect(403);
  await owner.agent.delete(`/api/boards/${boardId}/columns/${added.body.id}`).expect(204);

  await owner.agent.delete(`/api/boards/${boardId}`).expect(204);
});

test('column routes: a column with cards, and the last column, are both refused deletion over HTTP', async () => {
  const created = await owner.agent.post('/api/boards').send({ name: 'Access Board I' }).expect(201);
  const boardId = created.body.id;
  const columns = await owner.agent.get(`/api/boards/${boardId}/columns`).expect(200);
  const [first, second, third] = columns.body;

  await owner.agent.post(`/api/boards/${boardId}/tasks`).send({ title: 'Holds the column open' }).expect(201);

  const withTasks = await owner.agent.delete(`/api/boards/${boardId}/columns/${first.id}`).expect(400);
  assert.match(withTasks.body.error, /still has tasks/);

  await owner.agent.delete(`/api/boards/${boardId}/columns/${second.id}`).expect(204);
  await owner.agent.delete(`/api/boards/${boardId}/columns/${third.id}`).expect(204);

  const lastOne = await owner.agent.delete(`/api/boards/${boardId}/columns/${first.id}`).expect(400);
  assert.match(lastOne.body.error, /still has tasks|last column/);

  await owner.agent.delete(`/api/boards/${boardId}`).expect(204);
});

test('a card cannot be created into a column belonging to someone else\'s board', async () => {
  const mine = await owner.agent.post('/api/boards').send({ name: 'Access Board J' }).expect(201);
  const theirs = await outsider.agent.post('/api/boards').send({ name: 'Access Board K' }).expect(201);
  const theirColumns = await outsider.agent.get(`/api/boards/${theirs.body.id}/columns`).expect(200);

  const res = await owner.agent
    .post(`/api/boards/${mine.body.id}/tasks`)
    .send({ title: 'Cross-board card', column_id: theirColumns.body[0].id })
    .expect(400);
  assert.match(res.body.error, /column of this board/);

  await owner.agent.delete(`/api/boards/${mine.body.id}`).expect(204);
  await outsider.agent.delete(`/api/boards/${theirs.body.id}`).expect(204);
});

test('the chat assistant endpoints require authentication', async () => {
  await request(app).post('/api/chat').send({ message: 'olá' }).expect(401);
  await request(app).post('/api/chat/confirm').send({ confirmation_token: 'x', confirm: true }).expect(401);
});

test.after(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE 'accesstest-%@example.com'");
  await pool.end();
});
