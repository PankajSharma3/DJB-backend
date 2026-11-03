const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  invoiceDate: {
    type: Date,
    default: Date.now
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  salesOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalesOrder',
    default: null
  },
  serviceJob: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    default: null
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: false,
      default: null
    },
    name: {
      type: String,
      default: ''
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      default: 1
    },
    discount: {
      type: Number,
      default: 0
    },
    taxable: {
      type: Number,
      required: true
    },
    cgstRate: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstRate: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstRate: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    total: {
      type: Number,
      required: true
    }
  }],
  taxCalculationMode: {
    type: String,
    enum: ['EXCLUSIVE', 'INCLUSIVE'],
    default: 'EXCLUSIVE'
  },
  discountAmount: {
    type: Number,
    default: 0
  },
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
  roundOff: {
    type: Number,
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
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'CANCELLED'],
    default: 'ACTIVE'
  },
  placeOfSupply: {
    type: String,
    default: 'Rajasthan'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Invoice', invoiceSchema);
