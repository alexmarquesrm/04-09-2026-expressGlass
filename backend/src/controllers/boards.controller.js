const boardsService = require('../services/boards.service');
const { parseId, validateBoardFields } = require('../utils/validation');

async function index(req, res, next) {
  try {
    const boards = await boardsService.listBoards();
    res.json(boards);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    validateBoardFields(req.body, { requireName: true });
    const board = await boardsService.createBoard(req.body);
    res.status(201).json(board);
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const id = parseId(req.params.id, 'board');
    const board = await boardsService.getBoard(id);
    if (!board) {
      const err = new Error('board not found');
      err.status = 404;
      throw err;
    }
    res.json(board);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseId(req.params.id, 'board');
    validateBoardFields(req.body, { requireName: false });
    const board = await boardsService.updateBoard(id, req.body);
    if (!board) {
      const err = new Error('board not found');
      err.status = 404;
      throw err;
    }
    res.json(board);
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    const id = parseId(req.params.id, 'board');
    const deleted = await boardsService.deleteBoard(id);
    if (!deleted) {
      const err = new Error('board not found');
      err.status = 404;
      throw err;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { index, create, show, update, destroy };
