const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const env = require('../config/env');

/**
 * Authentication middleware.
 * Extracts and verifies a JWT from the Authorization header.
 * Attaches { userId, businessId } to req.user.
 */
const protect = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    // 2. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'billflow-pro'
      });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Your session has expired. Please log in again.', 401));
      }
      return next(new AppError('Invalid authentication token.', 401));
    }

    // 3. Validate required claims
    if (!decoded.userId || !decoded.businessId) {
      return next(new AppError('Invalid authentication token.', 401));
    }

    // 4. Attach verified identity to request — this is the ONLY source of truth
    //    for userId and businessId in all downstream handlers/services.
    req.user = {
      userId: decoded.userId,
      businessId: decoded.businessId
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { protect };
