import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Generate secure random token
export const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate JWT token with expiration
export const generateJWTToken = (payload, expiresIn = '1h') => {
  return jwt.sign(payload, process.env.JWT_SECRET_KEY, { expiresIn });
};

// Generate verification token (24 hours)
export const generateVerificationToken = (userId, email) => {
  return jwt.sign(
    { userId, email, type: 'verification' },
    process.env.JWT_SECRET_KEY,
    { expiresIn: '24h' }
  );
};

// Generate password reset token (1 hour)
export const generatePasswordResetToken = (userId, email) => {
  return jwt.sign(
    { userId, email, type: 'password_reset' },
    process.env.JWT_SECRET_KEY,
    { expiresIn: '1h' }
  );
};

// Verify token and return payload
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};