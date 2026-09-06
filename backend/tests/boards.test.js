const test = require('node:test');
const assert = require('node:assert');
const pool = require('../src/db/pool');
const boardsService = require('../src/services/boards.service');
const boardTasksService = require('../src/services/boardTasks.service');
const boardMembersService = require('../src/services/boardMembers.service');
const authService = require('../src/services/auth.service');

function uniqueEmail() {
  return `boardtest-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function makeUser(name) {
  return authService.createUser({ name, email: uniqueEmail(), password: 'supersecret' });
}

let owner;

test.before(async () => {
  owner = await makeUser('Default Owner');
});

test('full board lifecycle: create, get, list, update, delete', async () => {
  const created = await boardsService.createBoard({ name: 'Integration test board' }, owner.id);
  assert.strictEqual(created.name, 'Integration test board');

  const fetched = await boardsService.getBoard(created.id);
  assert.strictEqual(fetched.id, created.id);

  const all = await boardMembersService.listBoardsForUser(owner.id);
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

test('creating a board automatically makes the creator an owner member', async () => {
  const board = await boardsService.createBoard({ name: 'Ownership test board' }, owner.id);
  const membership = await boardMembersService.getMembership(board.id, owner.id);
  assert.ok(membership);
  assert.strictEqual(membership.role, 'owner');
  await boardsService.deleteBoard(board.id);
});

test('deleting a board cascades to its tasks', async () => {
  const board = await boardsService.createBoard({ name: 'Cascade test board' }, owner.id);
  const boardTask = await boardTasksService.createBoardTask(board.id, { title: 'Task on doomed board' });

  await boardsService.deleteBoard(board.id);

  const afterDelete = await boardTasksService.getBoardTask(board.id, boardTask.id);
  assert.strictEqual(afterDelete, null);
});

test('deleting a board cascades to its memberships', async () => {
  const board = await boardsService.createBoard({ name: 'Membership cascade test board' }, owner.id);
  await boardsService.deleteBoard(board.id);
  const membership = await boardMembersService.getMembership(board.id, owner.id);
  assert.strictEqual(membership, null);
});

test('board tasks are scoped to their board: a task on one board is invisible via another board id', async () => {
  const boardA = await boardsService.createBoard({ name: 'Board A' }, owner.id);
  const boardB = await boardsService.createBoard({ name: 'Board B' }, owner.id);
  const task = await boardTasksService.createBoardTask(boardA.id, { title: 'Only on board A' });

  const viaWrongBoard = await boardTasksService.getBoardTask(boardB.id, task.id);
  assert.strictEqual(viaWrongBoard, null);

  const viaRightBoard = await boardTasksService.getBoardTask(boardA.id, task.id);
  assert.strictEqual(viaRightBoard.id, task.id);

  await boardsService.deleteBoard(boardA.id);
  await boardsService.deleteBoard(boardB.id);
});

test('createBoardTask defaults priority to medium, tags to empty, position to 0', async () => {
  const board = await boardsService.createBoard({ name: 'Defaults test board' }, owner.id);
  const task = await boardTasksService.createBoardTask(board.id, { title: 'Defaults test task' });
  assert.strictEqual(task.priority, 'medium');
  assert.deepStrictEqual(task.tags, []);
  assert.strictEqual(task.position, 0);
  await boardsService.deleteBoard(board.id);
});

test('due_date on a board task round-trips without shifting a day', async () => {
  const board = await boardsService.createBoard({ name: 'Due date test board' }, owner.id);
  const task = await boardTasksService.createBoardTask(board.id, { title: 'Due date task', due_date: '2026-10-01' });
  assert.strictEqual(task.due_date, '2026-10-01');
  await boardsService.deleteBoard(board.id);
});

test('a board task can carry several assignees, returned with their names', async () => {
  const board = await boardsService.createBoard({ name: 'Assignment test board' }, owner.id);
  const userA = await makeUser('Assignee Person');
  const userB = await makeUser('Second Person');
  await boardMembersService.addMember(board.id, userA.id, 'member');
  await boardMembersService.addMember(board.id, userB.id, 'member');

  const task = await boardTasksService.createBoardTask(board.id, {
    title: 'Assigned task',
    assignee_ids: [userA.id, userB.id],
  });
  assert.deepStrictEqual(task.assignees.map((a) => a.name), ['Assignee Person', 'Second Person']);

  const fetched = await boardTasksService.getBoardTask(board.id, task.id);
  assert.deepStrictEqual(fetched.assignees.map((a) => a.user_id).sort(), [userA.id, userB.id].sort());

  const listed = await boardTasksService.listBoardTasks(board.id);
  assert.strictEqual(listed[0].assignees.length, 2);

  await boardsService.deleteBoard(board.id);
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [[userA.id, userB.id]]);
});

test('a task with nobody on it carries an empty assignees array, not null', async () => {
  const board = await boardsService.createBoard({ name: 'Unassigned test board' }, owner.id);
  const task = await boardTasksService.createBoardTask(board.id, { title: 'Nobody on this' });
  assert.deepStrictEqual(task.assignees, []);

  const listed = await boardTasksService.listBoardTasks(board.id);
  assert.deepStrictEqual(listed[0].assignees, []);

  await boardsService.deleteBoard(board.id);
});

test('creating a task with a nonexistent assignee id is rejected with a 400, not a raw DB error', async () => {
  const board = await boardsService.createBoard({ name: 'Bad assignee test board' }, owner.id);
  await assert.rejects(
    () => boardTasksService.createBoardTask(board.id, { title: 'Bad assignee', assignee_ids: [999999] }),
    (err) => err.status === 400
  );
  await boardsService.deleteBoard(board.id);
});

test('a single non-member among several assignees rejects the whole assignment', async () => {
  const board = await boardsService.createBoard({ name: 'Non-member assignee test board' }, owner.id);
  const member = await makeUser('Real Member');
  const outsider = await makeUser('Not A Member');
  await boardMembersService.addMember(board.id, member.id, 'member');

  await assert.rejects(
    () => boardTasksService.createBoardTask(board.id, { title: 'Bad assignee', assignee_ids: [member.id, outsider.id] }),
    (err) => err.status === 400 && /must be a member of this board/.test(err.message)
  );

  // and nothing was half-written
  assert.deepStrictEqual(await boardTasksService.listBoardTasks(board.id), []);

  await boardsService.deleteBoard(board.id);
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [[member.id, outsider.id]]);
});

test('deleting a user removes them from a card instead of blocking the deletion', async () => {
  const board = await boardsService.createBoard({ name: 'Assignee deletion test board' }, owner.id);
  const staying = await makeUser('Still Here');
  const going = await makeUser('Soon Deleted');
  await boardMembersService.addMember(board.id, staying.id, 'member');
  await boardMembersService.addMember(board.id, going.id, 'member');
  const task = await boardTasksService.createBoardTask(board.id, {
    title: 'Task with a doomed assignee',
    assignee_ids: [staying.id, going.id],
  });

  await pool.query('DELETE FROM users WHERE id = $1', [going.id]);

  const afterUserDeleted = await boardTasksService.getBoardTask(board.id, task.id);
  assert.deepStrictEqual(afterUserDeleted.assignees.map((a) => a.user_id), [staying.id]);

  await boardsService.deleteBoard(board.id);
  await pool.query('DELETE FROM users WHERE id = $1', [staying.id]);
});

test('updating assignee_ids replaces the whole set, and an empty array clears it', async () => {
  const board = await boardsService.createBoard({ name: 'Reassignment test board' }, owner.id);
  const userA = await makeUser('User A');
  const userB = await makeUser('User B');
  await boardMembersService.addMember(board.id, userA.id, 'member');
  await boardMembersService.addMember(board.id, userB.id, 'member');
  const task = await boardTasksService.createBoardTask(board.id, { title: 'Reassign me', assignee_ids: [userA.id] });

  const both = await boardTasksService.updateBoardTask(board.id, task.id, { assignee_ids: [userA.id, userB.id] });
  assert.strictEqual(both.assignees.length, 2);

  const onlyB = await boardTasksService.updateBoardTask(board.id, task.id, { assignee_ids: [userB.id] });
  assert.deepStrictEqual(onlyB.assignees.map((a) => a.name), ['User B']);

  const nobody = await boardTasksService.updateBoardTask(board.id, task.id, { assignee_ids: [] });
  assert.deepStrictEqual(nobody.assignees, []);

  await boardsService.deleteBoard(board.id);
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [[userA.id, userB.id]]);
});

test('boardMembersService: add, list, and remove a member', async () => {
  const board = await boardsService.createBoard({ name: 'Members test board' }, owner.id);
  const member = await makeUser('Member Person');

  await boardMembersService.addMember(board.id, member.id, 'member');
  const members = await boardMembersService.listMembers(board.id);
  assert.strictEqual(members.length, 2);
  assert.ok(members.some((m) => m.user_id === member.id && m.role === 'member'));
  assert.ok(members.some((m) => m.user_id === owner.id && m.role === 'owner'));

  const removed = await boardMembersService.removeMember(board.id, member.id);
  assert.strictEqual(removed, true);
  assert.strictEqual(await boardMembersService.getMembership(board.id, member.id), null);

  await boardsService.deleteBoard(board.id);
  await pool.query('DELETE FROM users WHERE id = $1', [member.id]);
});

test('boardMembersService: listBoardsForUser only returns boards the user is a member of', async () => {
  const outsider = await makeUser('Outsider');
  const board = await boardsService.createBoard({ name: 'Visibility test board' }, owner.id);

  const outsiderBoards = await boardMembersService.listBoardsForUser(outsider.id);
  assert.ok(!outsiderBoards.some((b) => b.id === board.id));

  const ownerBoards = await boardMembersService.listBoardsForUser(owner.id);
  assert.ok(ownerBoards.some((b) => b.id === board.id));

  await boardsService.deleteBoard(board.id);
  await pool.query('DELETE FROM users WHERE id = $1', [outsider.id]);
});

test('boardMembersService: countOwners reflects the number of owner-role members', async () => {
  const board = await boardsService.createBoard({ name: 'Owner count test board' }, owner.id);
  assert.strictEqual(await boardMembersService.countOwners(board.id), 1);

  const secondOwner = await makeUser('Second Owner');
  await boardMembersService.addMember(board.id, secondOwner.id, 'owner');
  assert.strictEqual(await boardMembersService.countOwners(board.id), 2);

  await boardsService.deleteBoard(board.id);
  await pool.query('DELETE FROM users WHERE id = $1', [secondOwner.id]);
});

test.after(async () => {
  await pool.query('DELETE FROM users WHERE id = $1', [owner.id]);
  await pool.query("DELETE FROM users WHERE email LIKE 'boardtest-%@example.com'");
  await pool.end();
});
