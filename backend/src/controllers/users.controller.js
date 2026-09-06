const usersService = require('../services/users.service');

async function index(req, res, next) {
  try {
    const users = await usersService.listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

module.exports = { index };
