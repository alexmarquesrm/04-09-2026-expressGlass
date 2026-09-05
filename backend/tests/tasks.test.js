const test = require('node:test');
const assert = require('node:assert');
const pool = require('../src/db/pool');
const tasksService = require('../src/services/tasks.service');

test('full task lifecycle: create, get, list, update, delete', async () => {
  const created = await tasksService.createTask({ title: 'Integration test task', priority: 'high' });
  assert.strictEqual(created.title, 'Integration test task');
  assert.strictEqual(created.priority, 'high');
  assert.strictEqual(created.status, 'pending');

  const fetched = await tasksService.getTask(created.id);
  assert.strictEqual(fetched.id, created.id);

  const all = await tasksService.listTasks();
  assert.ok(all.some((t) => t.id === created.id));

  const pending = await tasksService.listTasks('pending');
  assert.ok(pending.some((t) => t.id === created.id));

  const updated = await tasksService.updateTask(created.id, { status: 'completed' });
  assert.strictEqual(updated.status, 'completed');

  const completed = await tasksService.listTasks('completed');
  assert.ok(completed.some((t) => t.id === created.id));

  const deleted = await tasksService.deleteTask(created.id);
  assert.strictEqual(deleted, true);

  const afterDelete = await tasksService.getTask(created.id);
  assert.strictEqual(afterDelete, null);
});

test('deleteTask returns false for a nonexistent id', async () => {
  const result = await tasksService.deleteTask(999999);
  assert.strictEqual(result, false);
});

test('createTask defaults priority to medium and tags to an empty array', async () => {
  const created = await tasksService.createTask({ title: 'Defaults test' });
  assert.strictEqual(created.priority, 'medium');
  assert.deepStrictEqual(created.tags, []);
  await tasksService.deleteTask(created.id);
});

test('updateTask ignores fields not in the allow-list (no mass assignment)', async () => {
  const created = await tasksService.createTask({ title: 'Allow-list test' });
  const updated = await tasksService.updateTask(created.id, { id: 999999, created_at: '2000-01-01' });
  assert.strictEqual(updated.id, created.id);
  await tasksService.deleteTask(created.id);
});

test.after(async () => {
  await pool.end();
});
