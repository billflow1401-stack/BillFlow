const AppError = require('../utils/AppError');
const env = require('../config/env');

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Handle Mongoose/MongoDB specific errors safely
  let error = { ...err, message: err.message };

  if (err.name === 'CastError') {
    error = new AppError(`Invalid ${err.path} format`, 400);
  }
  if (err.code === 11000) {
    const value = err.keyValue ? Object.values(err.keyValue)[0] : (err.errmsg?.match(/(["'])(\\?.)*?\1/)?.at(0) || 'Duplicate field');
    error = new AppError(`Duplicate field value: ${value}. Please use another value.`, 400);
  }
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(el => el.message);
    error = new AppError(`Invalid input data. ${errors.join('. ')}`, 400);
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new AppError('Malformed JSON payload', 400);
  }

  // Development vs Production response
  if (env.nodeEnv === 'development') {
    res.status(error.statusCode).json({
      success: false,
      status: error.status,
      error: error,
      message: error.message,
      stack: err.stack
    });
  } else {
    // Production (safe errors)
    if (error.isOperational) {
      res.status(error.statusCode).json({
        success: false,
        status: error.status,
        message: error.message
      });
    } else {
      // 1) Log error 
      console.error('ERROR 💥', err);
      // 2) Send generic message
      res.status(500).json({
        success: false,
        status: 'error',
        message: 'Something went very wrong!'
      });
    }
  }
};

module.exports = errorHandler;
