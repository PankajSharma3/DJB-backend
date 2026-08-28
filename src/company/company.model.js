const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  legalName: {
    type: String,
    required: true,
    default: 'D.J.B. EV WORLD'
  },
  tradeName: {
    type: String,
    required: true,
    default: 'D.J.B. EV WORLD'
  },
  pan: {
    type: String,
    required: true,
    default: 'ABAFD2540H'
  },
  gstin: {
    type: String,
    required: true,
    default: '08ABAFD2540H1ZS'
  },
  address: {
    floorNo: { type: String, default: 'FATEHPUR SHEKHAWATI' },
    buildingNo: { type: String, default: 'CHURU BYPASS' },
    buildingName: { type: String, default: 'NEAR MOTI PALACE HOTEL' },
    street: { type: String, default: 'NEAR MOTI PALACE HOTEL' },
    landmark: { type: String, default: 'N.H.52' },
    locality: { type: String, default: 'N.H.52, CHURU BYPASS' },
    city: { type: String, default: 'Fatehpur' },
    district: { type: String, default: 'Sikar' },
    state: { type: String, default: 'Rajasthan' },
    pinCode: { type: String, default: '332301' }
  },
  bankDetails: {
    bankName: { type: String, default: '' },
    accountNo: { type: String, default: '' },
    ifsc: { type: String, default: '' },
    branchName: { type: String, default: '' }
  },
  upiId: {
    type: String,
    default: ''
  },
  logoUrl: {
    type: String,
    default: '/mercury_ev_tech_logo.jpg'
  },
  signatureUrl: {
    type: String,
    default: ''
  },
  invoicePrefix: {
    type: String,
    default: 'DJB'
  },
  invoiceSuffix: {
    type: String,
    default: '/26-27/'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Company', companySchema);
