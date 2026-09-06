const express = require('express');
const boardsController = require('../controllers/boards.controller');
const boardTasksController = require('../controllers/boardTasks.controller');
const boardMembersController = require('../controllers/boardMembers.controller');
const boardColumnsController = require('../controllers/boardColumns.controller');
const requireAuth = require('../middleware/auth.middleware');
const { requireBoardMember, requireBoardOwner } = require('../middleware/boardAccess.middleware');

const router = express.Router();

router.get('/', requireAuth, boardsController.index);
router.post('/', requireAuth, boardsController.create);
router.get('/:id', requireAuth, requireBoardMember, boardsController.show);
router.patch('/:id', requireAuth, requireBoardOwner, boardsController.update);
router.delete('/:id', requireAuth, requireBoardOwner, boardsController.destroy);

router.get('/:id/members', requireAuth, requireBoardMember, boardMembersController.index);
router.post('/:id/members', requireAuth, requireBoardOwner, boardMembersController.create);
router.delete('/:id/members/:userId', requireAuth, requireBoardOwner, boardMembersController.destroy);

// Any member can shape the workflow (add/rename columns); deleting one is
// owner-only, since it affects every member's view of the board.
router.get('/:id/columns', requireAuth, requireBoardMember, boardColumnsController.index);
router.post('/:id/columns', requireAuth, requireBoardMember, boardColumnsController.create);
router.patch('/:id/columns/:columnId', requireAuth, requireBoardMember, boardColumnsController.update);
router.delete('/:id/columns/:columnId', requireAuth, requireBoardOwner, boardColumnsController.destroy);

router.get('/:boardId/tasks', requireAuth, requireBoardMember, boardTasksController.index);
router.post('/:boardId/tasks', requireAuth, requireBoardMember, boardTasksController.create);
router.get('/:boardId/tasks/:id', requireAuth, requireBoardMember, boardTasksController.show);
router.patch('/:boardId/tasks/:id', requireAuth, requireBoardMember, boardTasksController.update);
router.delete('/:boardId/tasks/:id', requireAuth, requireBoardMember, boardTasksController.destroy);

module.exports = router;
