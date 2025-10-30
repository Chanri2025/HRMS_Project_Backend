const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables.  If no `.env` file exists the
// defaults from `.env` will be used when executing via
// npm scripts because dotenv doesn't set any values for undefined
// variables; instead we rely on destructuring defaults below.
dotenv.config();

const {
  JWT_SECRET = 'change-me',
  ACCESS_MIN = '15',
  REFRESH_DAYS = '15'
} = process.env;

/**
 * Hash a plain text password using bcrypt.  A salt is generated
 * automatically.  Returns a promise that resolves to the hashed
 * password.
 *
 * @param {string} plain The raw password
 * @returns {Promise<string>} The bcrypt hash
 */
async function hashPassword(plain) {
  const saltRounds = 12;
  return bcrypt.hash(plain, saltRounds);
}

/**
 * Verify a password against a bcrypt hash.
 *
 * @param {string} plain The raw password
 * @param {string} hash The stored bcrypt hash
 * @returns {Promise<boolean>} True if the password matches
 */
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Create a signed JWT access token.  The payload contains the
 * subject (user id) and roles.  The token expires after
 * ``ACCESS_MIN`` minutes.
 *
 * @param {string} sub User identifier
 * @param {string[]} roles List of role names
 * @returns {string} A signed JWT
 */
function createAccessToken(sub, roles = []) {
  const exp = Math.floor(Date.now() / 1000) + parseInt(ACCESS_MIN, 10) * 60;
  const payload = { sub, roles, exp };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

/**
 * Decode and verify a JWT access token.  Throws if invalid or
 * expired.  Returns the payload object if valid.
 *
 * @param {string} token The JWT to decode
 * @returns {object} The decoded payload
 */
function decodeAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

/**
 * Generate a refresh token and its digest.  The raw token should
 * be returned to the client while the digest is stored in the
 * database.  We use Node's crypto API to generate a high
 * entropy token and compute a SHA256 hex digest.
 *
 * @returns {{ raw: string, digest: string }} The token and digest
 */
function makeRefreshToken() {
  const raw = crypto.randomBytes(48).toString('base64url');
  const digest = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, digest };
}

/**
 * Compute the expiry date for a refresh token based on
 * ``REFRESH_DAYS``.  Returns a JavaScript Date object set to the
 * expiration time in UTC.
 *
 * @returns {Date} The expiry timestamp
 */
function refreshExp() {
  const days = parseInt(REFRESH_DAYS, 10) || 15;
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + days);
  return expires;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createAccessToken,
  decodeAccessToken,
  makeRefreshToken,
  refreshExp
};