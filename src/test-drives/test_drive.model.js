const mongoose = require('mongoose');

const testDriveSchema = new mongoose.Schema({
  customer: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  licenseNo: {
    type: String,
    required: true,
    trim: true
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  startKm: {
    type: Number,
    required: true
  },
  endKm: {
    type: Number,
    default: null
  },
  feedback: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Completed', 'Cancelled'],
    default: 'Scheduled'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TestDrive', testDriveSchema);
