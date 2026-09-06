const test = require('node:test');
const assert = require('node:assert');
const pool = require('../src/db/pool');
const boardsService = require('../src/services/boards.service');
const boardColumnsService = require('../src/services/boardColumns.service');
const boardTasksService = require('../src/services/boardTasks.service');
const authService = require('../src/services/auth.service');

function uniqueEmail() {
  return `columntest-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

let owner;

test.before(async () => {
  owner = await authService.createUser({ name: 'Column Owner', email: uniqueEmail(), password: 'supersecret' });
});

test('a new board starts with the three default columns, in order', async () => {
  const board = await boardsService.createBoard({ name: 'Column defaults' }, owner.id);
  const columns = await boardColumnsService.listColumns(board.id);

  assert.deepStrictEqual(columns.map((c) => c.name), boardColumnsService.DEFAULT_COLUMN_NAMES);
  assert.deepStrictEqual(columns.map((c) => c.position), [0, 10, 20]);

  await boardsService.deleteBoard(board.id);
});

test('a task with no column_id lands in the first column, and can be moved to another', async () => {
  const board = await boardsService.createBoard({ name: 'Column placement' }, owner.id);
  const [first, second] = await boardColumnsService.listColumns(board.id);

  const task = await boardTasksService.createBoardTask(board.id, { title: 'Placed automatically' });
  assert.strictEqual(task.column_id, first.id);

  const moved = await boardTasksService.updateBoardTask(board.id, task.id, { column_id: second.id });
  assert.strictEqual(moved.column_id, second.id);

  await boardsService.deleteBoard(board.id);
});

test('a column from another board is rejected on both create and update', async () => {
  const board = await boardsService.createBoard({ name: 'Column scoping A' }, owner.id);
  const other = await boardsService.createBoard({ name: 'Column scoping B' }, owner.id);
  const [otherColumn] = await boardColumnsService.listColumns(other.id);

  await assert.rejects(
    () => boardTasksService.createBoardTask(board.id, { title: 'Wrong board', column_id: otherColumn.id }),
    /column_id must be a column of this board/
  );

  const task = await boardTasksService.createBoardTask(board.id, { title: 'Right board' });
  await assert.rejects(
    () => boardTasksService.updateBoardTask(board.id, task.id, { column_id: otherColumn.id }),
    /column_id must be a column of this board/
  );

  await boardsService.deleteBoard(board.id);
  await boardsService.deleteBoard(other.id);
});

test('a column that still has tasks cannot be deleted', async () => {
  const board = await boardsService.createBoard({ name: 'Column not empty' }, owner.id);
  const [first] = await boardColumnsService.listColumns(board.id);
  await boardTasksService.createBoardTask(board.id, { title: 'Blocks deletion', column_id: first.id });

  const result = await boardColumnsService.deleteColumnSafely(board.id, first.id);
  assert.deepStrictEqual(result, { ok: false, reason: 'not_empty' });

  await boardsService.deleteBoard(board.id);
});

test('the last column of a board cannot be deleted, so a card always has somewhere to live', async () => {
  const board = await boardsService.createBoard({ name: 'Column last one' }, owner.id);
  const columns = await boardColumnsService.listColumns(board.id);

  // empty board, so the first two go away cleanly
  assert.deepStrictEqual(await boardColumnsService.deleteColumnSafely(board.id, columns[0].id), { ok: true });
  assert.deepStrictEqual(await boardColumnsService.deleteColumnSafely(board.id, columns[1].id), { ok: true });

  const result = await boardColumnsService.deleteColumnSafely(board.id, columns[2].id);
  assert.deepStrictEqual(result, { ok: false, reason: 'last_column' });

  await boardsService.deleteBoard(board.id);
});

test('renaming a column keeps its tasks, and deleting a board takes its columns with it', async () => {
  const board = await boardsService.createBoard({ name: 'Column rename' }, owner.id);
  const [first] = await boardColumnsService.listColumns(board.id);
  await boardTasksService.createBoardTask(board.id, { title: 'Survives a rename', column_id: first.id });

  const renamed = await boardColumnsService.updateColumn(board.id, first.id, { name: 'Em revisão' });
  assert.strictEqual(renamed.name, 'Em revisão');

  const tasks = await boardTasksService.listBoardTasks(board.id);
  assert.strictEqual(tasks.length, 1);
  assert.strictEqual(tasks[0].column_id, first.id);

  await boardsService.deleteBoard(board.id);
  assert.deepStrictEqual(await boardColumnsService.listColumns(board.id), []);
});

test('deleting a column that does not belong to the board reports not_found', async () => {
  const board = await boardsService.createBoard({ name: 'Column wrong board' }, owner.id);
  const other = await boardsService.createBoard({ name: 'Column wrong board other' }, owner.id);
  const [otherColumn] = await boardColumnsService.listColumns(other.id);

  const result = await boardColumnsService.deleteColumnSafely(board.id, otherColumn.id);
  assert.deepStrictEqual(result, { ok: false, reason: 'not_found' });

  await boardsService.deleteBoard(board.id);
  await boardsService.deleteBoard(other.id);
});

test.after(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE 'columntest-%@example.com'");
  await pool.end();
});
