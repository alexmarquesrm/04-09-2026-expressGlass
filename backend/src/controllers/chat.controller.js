const llmService = require('../services/llm.service');
const { validateChatMessage, validateConfirmationToken, badRequest } = require('../utils/validation');

async function sendMessage(req, res, next) {
  try {
    validateChatMessage(req.body.message);
    const result = await llmService.handleMessage(req.body.message);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function confirmAction(req, res, next) {
  try {
    const token = validateConfirmationToken(req.body.confirmation_token);
    if (typeof req.body.confirm !== 'boolean') {
      throw badRequest('confirm must be a boolean');
    }
    const result = await llmService.confirmAction(token, req.body.confirm);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { sendMessage, confirmAction };
