/* eslint-env node */

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

module.exports = {
  parseMaybeJson,
};
