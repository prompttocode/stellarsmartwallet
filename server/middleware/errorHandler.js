/* eslint-env node */

function errorHandler(error, req, res, _next) {
  const status = error.status || 500;

  res.status(status).json({
    error: error.message || 'Có lỗi không rõ',
    details: error.details || error.response?.data || null,
  });
}

module.exports = {
  errorHandler,
};
