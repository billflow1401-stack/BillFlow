const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  businessId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Business', 
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    unique: true // Email uniqueness is global across users for auth purposes
  },
  passwordHash: { 
    type: String, 
    required: true,
    select: false // Never returned in queries unless explicitly selected
  },
  role: { 
    type: String, 
    enum: ['Admin', 'Manager', 'Viewer'],
    default: 'Admin'
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
