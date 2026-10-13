const crypto = require('crypto');

// Cryptographically secure temporary password (16 chars, URL-safe base64).
// Math.random() is predictable and must never be used for credentials.
function generateTempPassword(bytes = 12) {
  return crypto.randomBytes(bytes).toString('base64url');
}

module.exports = { generateTempPassword };
