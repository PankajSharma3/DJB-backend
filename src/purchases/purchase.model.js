const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  purchaseOrderNo: {
    type: String,
    trim: true,
    default: ''
  },
  invoiceNo: {
    type: String,
    required: true,
    trim: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    purchasePrice: {
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
    totalAmount: {
      type: Number,
      required: true
    }
  }],
  taxableAmount: {
    type: Number,
    required: true,
    default: 0
  },
  cgstAmount: {
    type: Number,
    required: true,
    default: 0
  },
  sgstAmount: {
    type: Number,
    required: true,
    default: 0
  },
  igstAmount: {
    type: Number,
    required: true,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Partial', 'Unpaid'],
    default: 'Paid'
  },
  outstandingAmount: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Purchase', purchaseSchema);
