const Invoice = require('./invoice.model');
const Vehicle = require('../vehicles/vehicle.model');
const Customer = require('../customers/customer.model');
const Product = require('../products/product.model');
const SalesOrder = require('../sales/sales_order.model');
const Company = require('../company/company.model');
const { logAudit } = require('../utils/audit');
const mongoose = require('mongoose');

const getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('customer')
      .populate('items.product')
      .populate('items.vehicle')
      .sort({ invoiceDate: -1 });
    res.json(invoices);
  } catch (error) {
    console.error('getInvoices error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer')
      .populate('items.product')
      .populate('items.vehicle');
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    console.error('getInvoiceById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const generateNextInvoiceNumber = async () => {
  const prefix = 'DJB';
  const fySuffix = '/26-27/'; // FY 2026-27 as per SRS
  
  // Find the last invoice that matches the current prefix & FY
  const regex = new RegExp(`^${prefix}${fySuffix}\\d{4}$`);
  const lastInvoice = await Invoice.findOne({ invoiceNo: regex })
    .sort({ invoiceNo: -1 })
    .exec();
    
  let nextNum = 1;
  if (lastInvoice) {
    const parts = lastInvoice.invoiceNo.split('/');
    const lastNumStr = parts[parts.length - 1];
    nextNum = parseInt(lastNumStr, 10) + 1;
  }
  
  return `${prefix}${fySuffix}${String(nextNum).padStart(4, '0')}`;
};

const createInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { customer, salesOrder, items, discountAmount, placeOfSupply } = req.body;
    
    if (!customer || !items || items.length === 0) {
      return res.status(400).json({ message: 'Customer and items are required to generate invoice' });
    }

    const customerDoc = await Customer.findById(customer).session(session);
    if (!customerDoc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Customer not found' });
    }

    const companyDoc = await Company.findOne().session(session);
    const taxCalculationMode = req.body.taxCalculationMode || companyDoc?.taxCalculationMode || 'EXCLUSIVE';

    const isInterState = customerDoc.gstin ? !customerDoc.gstin.startsWith('08') : (placeOfSupply !== 'Rajasthan');
    
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let totalAmount = 0;
    
    const preparedItems = [];
    
    for (const item of items) {
      const productDoc = await Product.findById(item.product).session(session);
      if (!productDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: `Product ${item.product} not found` });
      }
      
      let vehicleId = null;
      if (item.vehicle) {
        const vehicleDoc = await Vehicle.findById(item.vehicle).session(session);
        if (!vehicleDoc) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({ message: `Vehicle unit ${item.vehicle} not found` });
        }
        
        if (vehicleDoc.status !== 'AVAILABLE' && vehicleDoc.status !== 'RESERVED') {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: `Vehicle ${vehicleDoc.chassisNo} is not saleable (Status: ${vehicleDoc.status})` });
        }
        
        vehicleId = vehicleDoc._id;
        // Update vehicle status to SOLD and link customer
        vehicleDoc.status = 'SOLD';
        vehicleDoc.customer = customerDoc._id;
        await vehicleDoc.save({ session });
      }
      
      const qty = Number(item.quantity || 1);
      const price = Number(item.price || productDoc.sellingPrice);
      const discount = Number(item.discount || 0);
      const gstRate = Number(productDoc.gstRate || 18);
      
      let itemTaxable = 0;
      let itemGst = 0;
      let itemTotal = 0;

      if (taxCalculationMode === 'INCLUSIVE') {
        // Price entered already includes GST
        const grossAmount = (qty * price) - discount;
        itemTaxable = Number((grossAmount / (1 + (gstRate / 100))).toFixed(2));
        itemGst = Number((grossAmount - itemTaxable).toFixed(2));
        itemTotal = grossAmount;
      } else {
        // Price entered is exclusive of GST (GST added on top)
        itemTaxable = Number(((qty * price) - discount).toFixed(2));
        itemGst = Number((itemTaxable * (gstRate / 100)).toFixed(2));
        itemTotal = Number((itemTaxable + itemGst).toFixed(2));
      }
      
      taxableAmount += itemTaxable;
      
      const cgstRate = isInterState ? 0 : gstRate / 2;
      const cgstVal = isInterState ? 0 : Number((itemGst / 2).toFixed(2));
      const sgstRate = isInterState ? 0 : gstRate / 2;
      const sgstVal = isInterState ? 0 : Number((itemGst / 2).toFixed(2));
      const igstRate = isInterState ? gstRate : 0;
      const igstVal = isInterState ? itemGst : 0;
      
      if (isInterState) {
        igstAmount += igstVal;
      } else {
        cgstAmount += cgstVal;
        sgstAmount += sgstVal;
      }
      
      totalAmount += itemTotal;
      
      preparedItems.push({
        product: item.product,
        vehicle: vehicleId,
        price,
        quantity: qty,
        discount,
        taxable: itemTaxable,
        cgstRate,
        cgstAmount: cgstVal,
        sgstRate,
        sgstAmount: sgstVal,
        igstRate,
        igstAmount: igstVal,
        total: itemTotal
      });
    }
    
    const headerDiscount = Number(discountAmount || 0);
    taxableAmount = Math.max(0, taxableAmount - headerDiscount);
    
    const finalTotal = Math.round(totalAmount);
    const roundOff = Number((finalTotal - totalAmount).toFixed(2));
    
    const invoiceNo = await generateNextInvoiceNumber();
    
    const invoice = new Invoice({
      invoiceNo,
      invoiceDate: new Date(),
      customer,
      salesOrder: salesOrder || null,
      taxCalculationMode,
      items: preparedItems,
      discountAmount: headerDiscount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      roundOff,
      totalAmount: finalTotal,
      outstandingAmount: 0,
      paymentStatus: 'Paid',
      status: 'ACTIVE',
      placeOfSupply: placeOfSupply || 'Rajasthan'
    });
    
    await invoice.save({ session });
    
    // Update customer outstanding receivable balance
    customerDoc.balance += invoice.outstandingAmount; // Adds 0 since invoice is Paid
    await customerDoc.save({ session });
    
    // If invoice is created from a sales order (reservation), update booking status to INVOICED
    if (salesOrder) {
      const booking = await SalesOrder.findById(salesOrder).session(session);
      if (booking) {
        booking.status = 'INVOICED';
        await booking.save({ session });
      }
    }
    
    await session.commitTransaction();
    session.endSession();
    
    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'Invoice',
      entityId: invoice._id.toString(),
      details: `Generated sales invoice: ${invoiceNo} for customer ${customerDoc.name}. Total: ${finalTotal}`,
      afterData: invoice.toObject()
    });
    
    res.status(201).json(invoice);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('createInvoice error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const cancelInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const invoice = await Invoice.findById(req.params.id).session(session);
    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    if (invoice.status === 'CANCELLED') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Invoice is already cancelled' });
    }
    
    const customerDoc = await Customer.findById(invoice.customer).session(session);
    if (customerDoc) {
      // Revert outstanding balance
      customerDoc.balance -= invoice.outstandingAmount;
      await customerDoc.save({ session });
    }
    
    const oldData = invoice.toObject();
    invoice.status = 'CANCELLED';
    invoice.outstandingAmount = 0;
    invoice.paymentStatus = 'Paid'; // Set as paid so it doesn't show outstanding
    await invoice.save({ session });
    
    // Revert vehicle statuses to AVAILABLE
    for (const item of invoice.items) {
      if (item.vehicle) {
        const vehicle = await Vehicle.findById(item.vehicle).session(session);
        if (vehicle) {
          vehicle.status = 'AVAILABLE';
          vehicle.customer = null;
          await vehicle.save({ session });
        }
      }
    }
    
    await session.commitTransaction();
    session.endSession();
    
    await logAudit({
      user: req.user.email,
      action: 'UPDATE',
      entity: 'Invoice',
      entityId: invoice._id.toString(),
      details: `Cancelled sales invoice: ${invoice.invoiceNo}. Outstanding balance reverted.`,
      beforeData: oldData,
      afterData: invoice.toObject()
    });
    
    res.json(invoice);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('cancelInvoice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const invoice = await Invoice.findById(req.params.id).session(session);
    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Revert customer balance: subtract outstandingAmount (if ACTIVE)
    if (invoice.status === 'ACTIVE') {
      const customerDoc = await Customer.findById(invoice.customer).session(session);
      if (customerDoc) {
        customerDoc.balance = Math.max(0, customerDoc.balance - invoice.outstandingAmount);
        await customerDoc.save({ session });
      }
    }

    // Revert vehicle status back to AVAILABLE
    for (const item of invoice.items) {
      if (item.vehicle) {
        const vehicle = await Vehicle.findById(item.vehicle).session(session);
        if (vehicle) {
          vehicle.status = 'AVAILABLE';
          vehicle.customer = null;
          await vehicle.save({ session });
        }
      }
    }

    // If it was linked to a service job card, clear the link and paymentStatus
    if (invoice.serviceJob) {
      const Service = require('../service/service.model');
      const serviceRecord = await Service.findById(invoice.serviceJob).session(session);
      if (serviceRecord) {
        serviceRecord.invoice = null;
        serviceRecord.paymentStatus = 'Pending';
        await serviceRecord.save({ session });
      }
    }

    await Invoice.deleteOne({ _id: req.params.id }).session(session);

    await session.commitTransaction();
    session.endSession();

    await logAudit({
      user: req.user.email,
      action: 'DELETE',
      entity: 'Invoice',
      entityId: req.params.id,
      details: `Deleted invoice: ${invoice.invoiceNo}. Ledger updated.`,
      beforeData: invoice.toObject()
    });

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('deleteInvoice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { customer, placeOfSupply, items, discountAmount, status, paymentStatus } = req.body;
    
    const invoice = await Invoice.findById(req.params.id).session(session);
    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const oldData = invoice.toObject();

    // 1. Customer transition logic
    let oldCustomerDoc = await Customer.findById(invoice.customer).session(session);
    let newCustomerDoc = oldCustomerDoc;

    if (customer && customer !== invoice.customer.toString()) {
      newCustomerDoc = await Customer.findById(customer).session(session);
      if (!newCustomerDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'New customer not found' });
      }
      // Revert outstanding balance from old customer
      if (oldCustomerDoc && invoice.status === 'ACTIVE') {
        oldCustomerDoc.balance = Math.max(0, oldCustomerDoc.balance - invoice.outstandingAmount);
        await oldCustomerDoc.save({ session });
      }
      invoice.customer = customer;
    }

    // 2. Place of supply
    if (placeOfSupply !== undefined) {
      invoice.placeOfSupply = placeOfSupply;
    }

    const currentPlaceOfSupply = placeOfSupply || invoice.placeOfSupply;
    const isInterState = newCustomerDoc.gstin ? !newCustomerDoc.gstin.startsWith('08') : (currentPlaceOfSupply !== 'Rajasthan');

    // 3. Status changes (ACTIVE vs CANCELLED)
    let originalStatus = invoice.status;
    if (status !== undefined && status !== invoice.status) {
      invoice.status = status;
      if (status === 'CANCELLED') {
        invoice.outstandingAmount = 0;
        invoice.paymentStatus = 'Paid';
        
        // Revert old vehicles to AVAILABLE
        for (const item of invoice.items) {
          if (item.vehicle) {
            const vehicle = await Vehicle.findById(item.vehicle).session(session);
            if (vehicle) {
              vehicle.status = 'AVAILABLE';
              vehicle.customer = null;
              await vehicle.save({ session });
            }
          }
        }
      } else if (status === 'ACTIVE' && originalStatus === 'CANCELLED') {
        // If reactivating from CANCELLED, we will set outstanding amount back to total amount
        invoice.paymentStatus = 'Unpaid';
      }
    }

    // 4. Update items if provided (only if active)
    if (invoice.status === 'ACTIVE' && items && items.length > 0) {
      // Revert old vehicle statuses to AVAILABLE
      for (const item of invoice.items) {
        if (item.vehicle) {
          const vehicle = await Vehicle.findById(item.vehicle).session(session);
          if (vehicle) {
            vehicle.status = 'AVAILABLE';
            vehicle.customer = null;
            await vehicle.save({ session });
          }
        }
      }

      let taxableAmount = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;
      let totalAmount = 0;
      
      const preparedItems = [];
      
      for (const item of items) {
        let productDoc = null;
        let productName = item.name || '';
        let gstRate = 18;
        
        if (item.product) {
          productDoc = await Product.findById(item.product).session(session);
          if (!productDoc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: `Product ${item.product} not found` });
          }
          productName = productDoc.name;
          gstRate = Number(productDoc.gstRate || 18);
        }
        
        let vehicleId = null;
        if (item.vehicle) {
          const vehicleDoc = await Vehicle.findById(item.vehicle).session(session);
          if (!vehicleDoc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: `Vehicle unit ${item.vehicle} not found` });
          }
          
          vehicleId = vehicleDoc._id;
          vehicleDoc.status = 'SOLD';
          vehicleDoc.customer = invoice.customer;
          await vehicleDoc.save({ session });
        }
        
        const qty = Number(item.quantity || 1);
        const price = Number(item.price || (productDoc ? productDoc.sellingPrice : 0));
        const discount = Number(item.discount || 0);
        
        const itemTaxable = (qty * price) - discount;
        const itemGst = itemTaxable * (gstRate / 100);
        const itemTotal = itemTaxable + itemGst;
        
        taxableAmount += itemTaxable;
        
        const cgstRate = isInterState ? 0 : gstRate / 2;
        const cgstVal = isInterState ? 0 : itemGst / 2;
        const sgstRate = isInterState ? 0 : gstRate / 2;
        const sgstVal = isInterState ? 0 : itemGst / 2;
        const igstRate = isInterState ? gstRate : 0;
        const igstVal = isInterState ? itemGst : 0;
        
        if (isInterState) {
          igstAmount += itemGst;
        } else {
          cgstAmount += itemGst / 2;
          sgstAmount += itemGst / 2;
        }
        
        totalAmount += itemTotal;
        
        preparedItems.push({
          product: item.product || null,
          name: productName,
          vehicle: vehicleId,
          price,
          quantity: qty,
          discount,
          taxable: itemTaxable,
          cgstRate,
          cgstAmount: cgstVal,
          sgstRate,
          sgstAmount: sgstVal,
          igstRate,
          igstAmount: igstVal,
          total: itemTotal
        });
      }
      
      const headerDiscount = Number(discountAmount !== undefined ? discountAmount : invoice.discountAmount);
      taxableAmount = Math.max(0, taxableAmount - headerDiscount);
      
      const finalTotal = Math.round(totalAmount);
      const roundOff = Number((finalTotal - totalAmount).toFixed(2));
      
      invoice.items = preparedItems;
      invoice.discountAmount = headerDiscount;
      invoice.taxableAmount = taxableAmount;
      invoice.cgstAmount = cgstAmount;
      invoice.sgstAmount = sgstAmount;
      invoice.igstAmount = igstAmount;
      invoice.roundOff = roundOff;
      
      // Calculate new outstandingAmount
      // Keep payments already made (oldTotal - oldOutstanding)
      const paymentsMade = Math.max(0, oldData.totalAmount - oldData.outstandingAmount);
      invoice.totalAmount = finalTotal;
      invoice.outstandingAmount = Math.max(0, finalTotal - paymentsMade);
      
      if (invoice.outstandingAmount === 0) {
        invoice.paymentStatus = 'Paid';
      } else if (invoice.outstandingAmount < finalTotal) {
        invoice.paymentStatus = 'Partial';
      } else {
        invoice.paymentStatus = 'Unpaid';
      }
    } else {
      // If items not updated, but discount updated
      if (discountAmount !== undefined && invoice.status === 'ACTIVE') {
        const diffDiscount = Number(discountAmount) - invoice.discountAmount;
        invoice.discountAmount = Number(discountAmount);
        invoice.taxableAmount = Math.max(0, invoice.taxableAmount - diffDiscount);
      }
    }

    // 5. Payment Status override (Manual toggle)
    if (paymentStatus !== undefined && paymentStatus !== invoice.paymentStatus) {
      invoice.paymentStatus = paymentStatus;
      if (paymentStatus === 'Paid') {
        invoice.outstandingAmount = 0;
      } else if (paymentStatus === 'Unpaid') {
        invoice.outstandingAmount = invoice.totalAmount;
      }
    }

    await invoice.save({ session });

    // 6. Update customer balance with the change
    if (invoice.status === 'ACTIVE') {
      const balanceDiff = invoice.outstandingAmount - oldData.outstandingAmount;
      if (customer && customer !== oldData.customer.toString()) {
        // If customer changed, we already subtracted the old amount from old customer.
        // Now add the new outstanding amount to the new customer.
        newCustomerDoc.balance += invoice.outstandingAmount;
        await newCustomerDoc.save({ session });
      } else {
        // Same customer, adjust balance by difference
        newCustomerDoc.balance += balanceDiff;
        await newCustomerDoc.save({ session });
      }
    }

    // 7. If linked to service card, sync paymentStatus back to service card
    if (invoice.serviceJob) {
      const Service = require('../service/service.model');
      const serviceRecord = await Service.findById(invoice.serviceJob).session(session);
      if (serviceRecord) {
        serviceRecord.paymentStatus = invoice.paymentStatus === 'Paid' ? 'Paid' : 'Pending';
        await serviceRecord.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    await logAudit({
      user: req.user.email,
      action: 'UPDATE',
      entity: 'Invoice',
      entityId: invoice._id.toString(),
      details: `Updated sales invoice: ${invoice.invoiceNo}. Total: ${invoice.totalAmount}`,
      beforeData: oldData,
      afterData: invoice.toObject()
    });

    res.json(invoice);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('updateInvoice error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = {
  getInvoices,
  getInvoiceById,
  createInvoice,
  cancelInvoice,
  generateNextInvoiceNumber,
  updateInvoice,
  deleteInvoice
};
