/* eslint-env node */

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function isEmailLike(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = {
  isEmailLike,
  normalizeEmail,
};
