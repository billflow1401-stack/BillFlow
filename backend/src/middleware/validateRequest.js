const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      if (source === 'query') {
        req.query = parsed; // Reassign
        req.validatedQuery = parsed; // Safe fallback
      } else {
        req[source] = parsed;
      }
      next();
    } catch (error) {
      // Zod v4 uses .issues, Zod v3 used .errors
      const issues = error.issues || error.errors || [];
      const errors = issues.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));

      const details = errors.map(err => (err.path ? `${err.path}: ${err.message}` : err.message)).join(', ');

      res.status(400).json({
        success: false,
        status: 'fail',
        message: details ? `Validation failed: ${details}` : 'Validation failed',
        errors
      });
    }
  };
};

module.exports = validateRequest;
