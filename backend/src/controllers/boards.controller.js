const boardsService = require('../services/boards.service');
const boardMembersService = require('../services/boardMembers.service');
const { validateBoardFields } = require('../utils/validation');

async function index(req, res, next) {
  try {
    const boards = await boardMembersService.listBoardsForUser(req.user.id);
    res.json(boards);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    validateBoardFields(req.body, { requireName: true });
    const board = await boardsService.createBoard(req.body, req.user.id);
    res.status(201).json({ ...board, my_role: 'owner' });
  } catch (err) {
    next(err);
  }
}

async function show(req, res) {
  res.json({ ...req.board, my_role: req.boardMembership.role });
}

async function update(req, res, next) {
  try {
    validateBoardFields(req.body, { requireName: false });
    const board = await boardsService.updateBoard(req.boardId, req.body);
    res.json({ ...board, my_role: req.boardMembership.role });
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    await boardsService.deleteBoard(req.boardId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { index, create, show, update, destroy };
