const boardMembersService = require('../services/boardMembers.service');
const { validateMemberFields, parseId } = require('../utils/validation');

async function index(req, res, next) {
  try {
    const members = await boardMembersService.listMembers(req.boardId);
    res.json(members);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    validateMemberFields(req.body);
    const targetRole = req.body.role || 'member';
    const result = await boardMembersService.upsertMemberRoleSafely(req.boardId, req.body.user_id, targetRole);
    if (!result.ok) {
      const err = new Error('cannot demote the only owner of a board');
      err.status = 400;
      throw err;
    }
    res.status(201).json(result.member);
  } catch (err) {
    if (err.code === '23503') {
      err.status = 400;
      err.message = 'user_id does not reference an existing user';
    }
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    const userId = parseId(req.params.userId, 'user');
    const result = await boardMembersService.removeMemberSafely(req.boardId, userId);
    if (!result.ok) {
      const err = new Error(
        result.reason === 'not_found' ? 'that user is not a member of this board' : 'cannot remove the only owner of a board'
      );
      err.status = result.reason === 'not_found' ? 404 : 400;
      throw err;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { index, create, destroy };
