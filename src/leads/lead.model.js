const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    default: ''
  },
  source: {
    type: String,
    default: 'Walk-in'
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Test Drive Scheduled', 'Negotiation', 'Won', 'Lost'],
    default: 'New'
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  followUps: [{
    date: {
      type: Date,
      required: true
    },
    note: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Completed'],
      default: 'Pending'
    }
  }],
  assignedSalesperson: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Lead', leadSchema);
