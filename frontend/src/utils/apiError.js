/**
 * Extracts a clear, user-friendly error message from an API error response.
 * Formats multiple validation errors if present (e.g., from Zod or Mongoose)
 * so that users see exactly which field failed and why.
 *
 * @param {Error|Object} err - Axios error or generic error
 * @param {string} fallback - Default message if no error info is available
 * @returns {string} Formatted error message
 */
export const formatApiError = (err, fallback = 'Operation failed.') => {
  if (!err) return fallback;
  const resData = err.response?.data;
  
  if (resData) {
    // 1. If backend returned a structured array of validation errors
    if (Array.isArray(resData.errors) && resData.errors.length > 0) {
      const issues = resData.errors
        .map(e => {
          if (typeof e === 'string') return e;
          return e.path ? `${e.path}: ${e.message}` : e.message;
        })
        .filter(Boolean);
      if (issues.length > 0) {
        return issues.join(', ');
      }
    }

    // 2. If backend message is descriptive
    if (resData.message) {
      return resData.message;
    }
  }

  return err.message || fallback;
};

/**
 * Extracts field-by-field error mappings from an API response (e.g. for inline form errors).
 * @param {Error|Object} err
 * @returns {Record<string, string>} Map of field path to error message
 */
export const extractFieldErrors = (err) => {
  const map = {};
  const resData = err?.response?.data;
  if (Array.isArray(resData?.errors)) {
    resData.errors.forEach(e => {
      if (e.path && e.message) {
        map[e.path] = e.message;
      }
    });
  }
  return map;
};
