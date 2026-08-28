const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  jobCardNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  complaint: {
    type: String,
    required: true,
    trim: true
  },
  inspectionNotes: {
    type: String,
    trim: true,
    default: ''
  },
  technician: {
    type: String,
    trim: true,
    default: ''
  },
  partsUsed: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      default: 1
    },
    unitPrice: {
      type: Number,
      required: true
    },
    gstRate: {
      type: Number,
      required: true,
      default: 18
    },
    gstAmount: {
      type: Number,
      required: true
    },
    total: {
      type: Number,
      required: true
    }
  }],
  labourCharges: {
    type: Number,
    default: 0
  },
  partsTotal: {
    type: Number,
    default: 0
  },
  gstAmount: {
    type: Number,
    default: 0 // GST on labour + parts
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed', 'Delivered'],
    default: 'Pending'
  },
  completedDate: {
    type: Date,
    default: null
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    default: null
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Service', serviceSchema);
