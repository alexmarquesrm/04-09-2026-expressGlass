const test = require('node:test');
const assert = require('node:assert');
const pool = require('../src/db/pool');
const boardsService = require('../src/services/boards.service');
const boardTasksService = require('../src/services/boardTasks.service');
const authService = require('../src/services/auth.service');

function uniqueEmail() {
  return `boardtest-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

test('full board lifecycle: create, get, list, update, delete', async () => {
  const created = await boardsService.createBoard({ name: 'Integration test board' });
  assert.strictEqual(created.name, 'Integration test board');

  const fetched = await boardsService.getBoard(created.id);
  assert.strictEqual(fetched.id, created.id);

  const all = await boardsService.listBoards();
  assert.ok(all.some((b) => b.id === created.id));

  const updated = await boardsService.updateBoard(created.id, { name: 'Renamed board' });
  assert.strictEqual(updated.name, 'Renamed board');

  const deleted = await boardsService.deleteBoard(created.id);
  assert.strictEqual(deleted, true);

  const afterDelete = await boardsService.getBoard(created.id);
  assert.strictEqual(afterDelete, null);
});

test('deleteBoard returns false for a nonexistent id', async () => {
  const result = await boardsService.deleteBoard(999999);
  assert.strictEqual(result, false);
});

test('deleting a board cascades to its tasks', async () => {
  const board = await boardsService.createBoard({ name: 'Cascade test board' });
  const boardTask = await boardTasksService.createBoardTask(board.id, { title: 'Task on doomed board' });

  await boardsService.deleteBoard(board.id);

  const afterDelete = await boardTasksService.getBoardTask(board.id, boardTask.id);
  assert.strictEqual(afterDelete, null);
});

test('board tasks are scoped to their board: a task on one board is invisible via another board id', async () => {
  const boardA = await boardsService.createBoard({ name: 'Board A' });
  const boardB = await boardsService.createBoard({ name: 'Board B' });
  const task = await boardTasksService.createBoardTask(boardA.id, { title: 'Only on board A' });

  const viaWrongBoard = await boardTasksService.getBoardTask(boardB.id, task.id);
  assert.strictEqual(viaWrongBoard, null);

  const viaRightBoard = await boardTasksService.getBoardTask(boardA.id, task.id);
  assert.strictEqual(viaRightBoard.id, task.id);

  await boardsService.deleteBoard(boardA.id);
  await boardsService.deleteBoard(boardB.id);
});

test('createBoardTask defaults priority to medium, tags to empty, position to 0', async () => {
  const board = await boardsService.createBoard({ name: 'Defaults test board' });
  const task = await boardTasksService.createBoardTask(board.id, { title: 'Defaults test task' });
  assert.strictEqual(task.priority, 'medium');
  assert.deepStrictEqual(task.tags, []);
  assert.strictEqual(task.position, 0);
  await boardsService.deleteBoard(board.id);
});

test('due_date on a board task round-trips without shifting a day', async () => {
  const board = await boardsService.createBoard({ name: 'Due date test board' });
  const task = await boardTasksService.createBoardTask(board.id, { title: 'Due date task', due_date: '2026-10-01' });
  assert.strictEqual(task.due_date, '2026-10-01');
  await boardsService.deleteBoard(board.id);
});

test('a board task can be assigned to a user, and the join returns the assignee name', async () => {
  const board = await boardsService.createBoard({ name: 'Assignment test board' });
  const user = await authService.createUser({ name: 'Assignee Person', email: uniqueEmail(), password: 'supersecret' });

  const task = await boardTasksService.createBoardTask(board.id, { title: 'Assigned task', assignee_id: user.id });
  assert.strictEqual(task.assignee_id, user.id);
  assert.strictEqual(task.assignee_name, 'Assignee Person');

  const fetched = await boardTasksService.getBoardTask(board.id, task.id);
  assert.strictEqual(fetched.assignee_name, 'Assignee Person');

  await boardsService.deleteBoard(board.id);
  await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
});

test('creating a task with a nonexistent assignee_id is rejected with a 400, not a raw DB error', async () => {
  const board = await boardsService.createBoard({ name: 'Bad assignee test board' });
  await assert.rejects(
    () => boardTasksService.createBoardTask(board.id, { title: 'Bad assignee', assignee_id: 999999 }),
    (err) => err.status === 400 && /does not reference an existing user/.test(err.message)
  );
  await boardsService.deleteBoard(board.id);
});

test('deleting an assigned user sets the task assignee_id to null instead of blocking the deletion', async () => {
  const board = await boardsService.createBoard({ name: 'Assignee deletion test board' });
  const user = await authService.createUser({ name: 'Soon Deleted', email: uniqueEmail(), password: 'supersecret' });
  const task = await boardTasksService.createBoardTask(board.id, { title: 'Task with a doomed assignee', assignee_id: user.id });

  await pool.query('DELETE FROM users WHERE id = $1', [user.id]);

  const afterUserDeleted = await boardTasksService.getBoardTask(board.id, task.id);
  assert.strictEqual(afterUserDeleted.assignee_id, null);
  assert.strictEqual(afterUserDeleted.assignee_name, null);

  await boardsService.deleteBoard(board.id);
});

test('reassigning a task via updateBoardTask updates the assignee join', async () => {
  const board = await boardsService.createBoard({ name: 'Reassignment test board' });
  const userA = await authService.createUser({ name: 'User A', email: uniqueEmail(), password: 'supersecret' });
  const userB = await authService.createUser({ name: 'User B', email: uniqueEmail(), password: 'supersecret' });
  const task = await boardTasksService.createBoardTask(board.id, { title: 'Reassign me', assignee_id: userA.id });

  const reassigned = await boardTasksService.updateBoardTask(board.id, task.id, { assignee_id: userB.id });
  assert.strictEqual(reassigned.assignee_id, userB.id);
  assert.strictEqual(reassigned.assignee_name, 'User B');

  const unassigned = await boardTasksService.updateBoardTask(board.id, task.id, { assignee_id: null });
  assert.strictEqual(unassigned.assignee_id, null);
  assert.strictEqual(unassigned.assignee_name, null);

  await boardsService.deleteBoard(board.id);
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [[userA.id, userB.id]]);
});

test.after(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE 'boardtest-%@example.com'");
  await pool.end();
});
