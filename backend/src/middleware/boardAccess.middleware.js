const boardsService = require('../services/boards.service');
const boardMembersService = require('../services/boardMembers.service');
const { parseId } = require('../utils/validation');

async function loadBoardAndMembership(req) {
  const boardId = parseId(req.params.boardId || req.params.id, 'board');
  const board = await boardsService.getBoard(boardId);
  if (!board) {
    const err = new Error('board not found');
    err.status = 404;
    throw err;
  }
  const membership = await boardMembersService.getMembership(boardId, req.user.id);
  return { boardId, board, membership };
}

async function requireBoardMember(req, res, next) {
  try {
    const { boardId, board, membership } = await loadBoardAndMembership(req);
    if (!membership) {
      const err = new Error('you are not a member of this board');
      err.status = 403;
      throw err;
    }
    req.boardId = boardId;
    req.board = board;
    req.boardMembership = membership;
    next();
  } catch (err) {
    next(err);
  }
}

async function requireBoardOwner(req, res, next) {
  try {
    const { boardId, board, membership } = await loadBoardAndMembership(req);
    if (!membership || membership.role !== 'owner') {
      const err = new Error('only the board owner can do this');
      err.status = 403;
      throw err;
    }
    req.boardId = boardId;
    req.board = board;
    req.boardMembership = membership;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireBoardMember, requireBoardOwner };
