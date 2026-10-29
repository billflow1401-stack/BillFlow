const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
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

module.exports = validateQuery;
