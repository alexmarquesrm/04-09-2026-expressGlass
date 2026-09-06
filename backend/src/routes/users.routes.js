const express = require('express');
const usersController = require('../controllers/users.controller');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();

// Only used to populate member/assignee pickers on pages that already require a
// session, so there is no reason to hand the user roster to anonymous callers.
router.get('/', requireAuth, usersController.index);

module.exports = router;
