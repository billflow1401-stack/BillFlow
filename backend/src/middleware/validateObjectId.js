const mongoose = require('mongoose');

const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        status: 'fail',
        message: `Invalid ObjectId in parameter: ${paramName}`
      });
    }
    next();
  };
};

module.exports = validateObjectId;
