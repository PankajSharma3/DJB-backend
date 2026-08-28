const Payment = require('./payment.model');
const Invoice = require('../invoices/invoice.model');
const Purchase = require('../purchases/purchase.model');
const Customer = require('../customers/customer.model');
const Supplier = require('../suppliers/supplier.model');
const { logAudit } = require('../utils/audit');
const mongoose = require('mongoose');

const getPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('customer', 'name phone')
      .populate('supplier', 'name phone')
      .populate('invoice', 'invoiceNo')
      .populate('purchase', 'invoiceNo')
      .sort({ date: -1 });
    res.json(payments);
  } catch (error) {
    console.error('getPayments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { type, partyType, customer, supplier, amount, mode, referenceNo, invoice, purchase, notes } = req.body;
    
    if (!type || !partyType || !amount || !mode) {
      return res.status(400).json({ message: 'Type, Party Type, Amount, and Mode are required' });
    }

    const amt = Number(amount);
    const paymentNo = 'PMT-' + Date.now();
    
    let customerId = null;
    let supplierId = null;
    let invoiceId = null;
    let purchaseId = null;

    if (partyType === 'Customer') {
      const customerDoc = await Customer.findById(customer).session(session);
      if (!customerDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Customer not found' });
      }
      customerId = customerDoc._id;
      
      // Update customer balance: Receipt decreases balance, Payment increases balance
      if (type === 'Receipt') {
        customerDoc.balance -= amt;
      } else {
        customerDoc.balance += amt;
      }
      await customerDoc.save({ session });
      
      // If invoice reference is provided, update invoice outstanding and payment status
      if (invoice) {
        const invoiceDoc = await Invoice.findById(invoice).session(session);
        if (invoiceDoc) {
          invoiceId = invoiceDoc._id;
          invoiceDoc.outstandingAmount = Math.max(0, invoiceDoc.outstandingAmount - amt);
          
          if (invoiceDoc.outstandingAmount === 0) {
            invoiceDoc.paymentStatus = 'Paid';
          } else if (invoiceDoc.outstandingAmount < invoiceDoc.totalAmount) {
            invoiceDoc.paymentStatus = 'Partial';
          } else {
            invoiceDoc.paymentStatus = 'Unpaid';
          }
          await invoiceDoc.save({ session });
        }
      }
    } else if (partyType === 'Supplier') {
      const supplierDoc = await Supplier.findById(supplier).session(session);
      if (!supplierDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Supplier not found' });
      }
      supplierId = supplierDoc._id;
      
      // Update supplier balance: Payment decreases balance, Receipt increases balance
      if (type === 'Payment') {
        supplierDoc.balance -= amt;
      } else {
        supplierDoc.balance += amt;
      }
      await supplierDoc.save({ session });
      
      // If purchase reference is provided, update purchase outstanding and payment status
      if (purchase) {
        const purchaseDoc = await Purchase.findById(purchase).session(session);
        if (purchaseDoc) {
          purchaseId = purchaseDoc._id;
          purchaseDoc.outstandingAmount = Math.max(0, purchaseDoc.outstandingAmount - amt);
          
          if (purchaseDoc.outstandingAmount === 0) {
            purchaseDoc.paymentStatus = 'Paid';
          } else if (purchaseDoc.outstandingAmount < purchaseDoc.totalAmount) {
            purchaseDoc.paymentStatus = 'Partial';
          } else {
            purchaseDoc.paymentStatus = 'Unpaid';
          }
          await purchaseDoc.save({ session });
        }
      }
    }

    const payment = new Payment({
      paymentNo,
      date: new Date(),
      type,
      partyType,
      customer: customerId,
      supplier: supplierId,
      amount: amt,
      mode,
      referenceNo: referenceNo || '',
      invoice: invoiceId,
      purchase: purchaseId,
      notes: notes || ''
    });

    await payment.save({ session });
    await session.commitTransaction();
    session.endSession();

    await logAudit({
      user: req.user.email,
      action: 'PAYMENT',
      entity: 'Payment',
      entityId: payment._id.toString(),
      details: `Recorded ${type} transaction ${paymentNo}. Amount: ${amt} via ${mode}`,
      afterData: payment.toObject()
    });

    res.status(201).json(payment);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('createPayment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getPayments,
  createPayment
};
