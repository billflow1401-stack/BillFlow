const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../../controllers/auth.controller');
const validateRequest = require('../../middleware/validateRequest');
const { registerSchema, loginSchema } = require('../../validators/auth.validator');
const { protect } = require('../../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes'
});

router.post('/register', authLimiter, validateRequest(registerSchema), authController.register);
router.post('/login', authLimiter, validateRequest(loginSchema), authController.login);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.getMe);

module.exports = router;
