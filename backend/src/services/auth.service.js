const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Business = require('../models/Business');
const AppError = require('../utils/AppError');
const env = require('../config/env');

const SALT_ROUNDS = 12;

/**
 * Register a new user and create their initial business.
 * Returns the created user (without passwordHash) and a JWT.
 */
const registerUser = async ({ name, email, password, businessName }) => {
  // Check for existing user
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError('An account with this email already exists', 409);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create the minimal Business record required by the User schema
  const business = await Business.create({ name: businessName });

  // Create the user
  const user = await User.create({
    businessId: business._id,
    email: email.toLowerCase(),
    passwordHash,
    role: 'Admin',
    name
  });

  // Generate JWT
  const token = generateToken(user);

  // Return safe user object
  return {
    token,
    user: sanitizeUser(user),
    business: { _id: business._id, name: business.name }
  };
};

/**
 * Authenticate an existing user.
 * Returns the user (without passwordHash) and a JWT.
 */
const loginUser = async ({ email, password }) => {
  // Find user — explicitly select passwordHash since it may be excluded by default
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Compare password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  // Fetch business
  const business = await Business.findById(user.businessId).select('name');

  // Generate JWT
  const token = generateToken(user);

  return {
    token,
    user: sanitizeUser(user),
    business: business ? { _id: business._id, name: business.name } : null
  };
};

/**
 * Get the current authenticated user's profile.
 */
const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const business = await Business.findById(user.businessId).select('name');

  return {
    user: sanitizeUser(user),
    business: business ? { _id: business._id, name: business.name } : null
  };
};

/**
 * Generate a JWT containing only userId and businessId.
 */
const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, businessId: user.businessId },
    env.jwtSecret,
    { expiresIn: '7d', issuer: 'billflow-pro' }
  );
};

/**
 * Strip sensitive fields from a user document.
 */
const sanitizeUser = (user) => {
  const obj = user.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = { registerUser, loginUser, getCurrentUser };
