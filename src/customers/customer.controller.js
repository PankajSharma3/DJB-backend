const Customer = require('./customer.model');
const Invoice = require('../invoices/invoice.model');
const Payment = require('../payments/payment.model');
const { logAudit } = require('../utils/audit');

const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ name: 1 }).lean();
    res.json(customers);
  } catch (error) {
    console.error('getCustomers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Fetch customer transactions (invoices and payments)
    const invoices = await Invoice.find({ customer: req.params.id }).sort({ invoiceDate: -1 });
    const payments = await Payment.find({ customer: req.params.id }).sort({ date: -1 });
    
    res.json({
      customer,
      invoices,
      payments
    });
  } catch (error) {
    console.error('getCustomerById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, pan, gstin, address, balance } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and Phone are required' });
    }
    
    const customer = new Customer({
      name,
      phone,
      email: email || '',
      pan: pan || '',
      gstin: gstin || '',
      address: address || '',
      balance: balance || 0
    });
    
    await customer.save();
    
    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'Customer',
      entityId: customer._id.toString(),
      details: `Created customer record: ${name}`,
      afterData: customer.toObject()
    });
    
    res.status(201).json(customer);
  } catch (error) {
    console.error('createCustomer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    const oldData = customer.toObject();
    Object.assign(customer, req.body);
    await customer.save();
    
    await logAudit({
      user: req.user.email,
      action: 'UPDATE',
      entity: 'Customer',
      entityId: customer._id.toString(),
      details: `Updated customer: ${customer.name}`,
      beforeData: oldData,
      afterData: customer.toObject()
    });
    
    res.json(customer);
  } catch (error) {
    console.error('updateCustomer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;
    
    // Check associated invoices
    const invoiceCount = await Invoice.countDocuments({ customer: customerId });
    if (invoiceCount > 0) {
      return res.status(400).json({ message: 'Cannot delete customer: Associated invoices exist.' });
    }
    
    // Check associated payments
    const paymentCount = await Payment.countDocuments({ customer: customerId });
    if (paymentCount > 0) {
      return res.status(400).json({ message: 'Cannot delete customer: Associated payments exist.' });
    }
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    await Customer.deleteOne({ _id: customerId });
    
    await logAudit({
      user: req.user.email,
      action: 'DELETE',
      entity: 'Customer',
      entityId: customerId,
      details: `Deleted customer record: ${customer.name}`,
      beforeData: customer.toObject()
    });
    
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('deleteCustomer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
};
