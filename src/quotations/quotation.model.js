const mongoose = require('mongoose');

const quotationSchema = new mongoose.Schema({
  quotationNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerPhone: {
    type: String,
    required: true,
    trim: true
  },
  customerAddress: {
    type: String,
    trim: true,
    default: ''
  },
  customerGstin: {
    type: String,
    trim: true,
    default: ''
  },
  customerAadhar: {
    type: String,
    trim: true,
    default: ''
  },
  taxCalculationMode: {
    type: String,
    enum: ['EXCLUSIVE', 'INCLUSIVE'],
    default: 'EXCLUSIVE'
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
  terms: {
    type: String,
    default: '1. Prices are valid for 7 days.\n2. Delivery subject to stock availability.\n3. RTO & Insurance charges extra.'
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED'],
    default: 'DRAFT'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Quotation', quotationSchema);
