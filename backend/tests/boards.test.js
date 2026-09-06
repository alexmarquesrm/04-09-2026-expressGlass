const test = require('node:test');
const assert = require('node:assert');
const pool = require('../src/db/pool');
const boardsService = require('../src/services/boards.service');
const boardTasksService = require('../src/services/boardTasks.service');

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

test.after(async () => {
  await pool.end();
});
