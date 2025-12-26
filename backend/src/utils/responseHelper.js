// Response utility functions for consistent API responses

/**
 * Send a successful response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {Object} data - Response data
 * @param {string} message - Optional success message
 */
const sendSuccess = (res, statusCode = 200, data = null, message = null) => {
  const response = {
    success: true
  };

  if (message) {
    response.message = message;
  }

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {string} message - Error message
 * @param {Object} details - Optional error details
 */
const sendError = (res, statusCode = 400, message = 'An error occurred', details = null) => {
  const response = {
    success: false,
    message
  };

  if (details) {
    response.error = details;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  sendSuccess,
  sendError
};
