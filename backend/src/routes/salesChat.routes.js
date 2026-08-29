const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { salesChatLimiter, salesChatSessionLimiter } = require('../middlewares/rateLimiter.middleware');
const salesChatValidator = require('../validators/salesChat.validator');
const salesChatController = require('../controllers/salesChat.controller');

const router = Router();

router.get('/health', salesChatController.health);

router.post(
  '/session',
  salesChatSessionLimiter,
  validate(salesChatValidator.startSession),
  salesChatController.startSession
);
// SSE — one open connection per turn. salesChatLimiter's window/max is the
// actual defence against abuse; there's no per-route body-size concern
// beyond the validator's text length cap.
router.post(
  '/session/:id/message',
  salesChatLimiter,
  validate(salesChatValidator.postMessage),
  salesChatController.postMessage
);
router.post(
  '/session/:id/handoff',
  salesChatLimiter,
  validate(salesChatValidator.handoff),
  salesChatController.handoff
);
router.post(
  '/fallback-form',
  salesChatSessionLimiter,
  validate(salesChatValidator.fallbackForm),
  salesChatController.fallbackForm
);

module.exports = router;
