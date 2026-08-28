const Service = require('./service.model');
const Vehicle = require('../vehicles/vehicle.model');
const Customer = require('../customers/customer.model');
const Product = require('../products/product.model');
const { logAudit } = require('../utils/audit');
const mongoose = require('mongoose');

const getJobCards = async (req, res) => {
  try {
    const jobCards = await Service.find()
      .populate('vehicle')
      .populate('customer')
      .populate('partsUsed.product')
      .populate('invoice')
      .sort({ createdAt: -1 });

    const syncedCards = jobCards.map(jc => {
      const jcObj = jc.toObject();
      if (jc.invoice) {
        jcObj.paymentStatus = jc.invoice.paymentStatus === 'Paid' ? 'Paid' : 'Pending';
      }
      return jcObj;
    });

    res.json(syncedCards);
  } catch (error) {
    console.error('getJobCards error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getJobCardById = async (req, res) => {
  try {
    const jobCard = await Service.findById(req.params.id)
      .populate('vehicle')
      .populate('customer')
      .populate('partsUsed.product')
      .populate('invoice');
    if (!jobCard) {
      return res.status(404).json({ message: 'Job Card not found' });
    }
    const jcObj = jobCard.toObject();
    if (jobCard.invoice) {
      jcObj.paymentStatus = jobCard.invoice.paymentStatus === 'Paid' ? 'Paid' : 'Pending';
    }
    res.json(jcObj);
  } catch (error) {
    console.error('getJobCardById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createJobCard = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { vehicle, customer, complaint, technician } = req.body;
    
    if (!vehicle || !customer || !complaint) {
      return res.status(400).json({ message: 'Vehicle, Customer, and Complaint details are required' });
    }

    const vehicleDoc = await Vehicle.findById(vehicle).session(session);
    if (!vehicleDoc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Vehicle unit not found' });
    }

    const customerDoc = await Customer.findById(customer).session(session);
    if (!customerDoc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Customer not found' });
    }

    const jobCardNo = 'JC-' + Date.now();
    const serviceRecord = new Service({
      jobCardNo,
      date: new Date(),
      vehicle,
      customer,
      complaint,
      technician: technician || '',
      partsUsed: [],
      labourCharges: 0,
      partsTotal: 0,
      gstAmount: 0,
      totalAmount: 0,
      status: 'Pending'
    });

    await serviceRecord.save({ session });
    
    // Set vehicle status to SERVICE
    vehicleDoc.status = 'SERVICE';
    await vehicleDoc.save({ session });

    await session.commitTransaction();
    session.endSession();

    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'Service',
      entityId: serviceRecord._id.toString(),
      details: `Opened service job card: ${jobCardNo} for vehicle chassis ${vehicleDoc.chassisNo}`,
      afterData: serviceRecord.toObject()
    });

    res.status(201).json(serviceRecord);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('createJobCard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateJobCard = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { inspectionNotes, technician, partsUsed, labourCharges, status, customer, vehicle, complaint, paymentStatus } = req.body;
    
    const serviceRecord = await Service.findById(req.params.id).session(session);
    if (!serviceRecord) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Job Card not found' });
    }

    const oldData = serviceRecord.toObject();

    if (customer !== undefined && customer !== serviceRecord.customer.toString()) {
      const customerDoc = await Customer.findById(customer).session(session);
      if (customerDoc) {
        serviceRecord.customer = customer;
      }
    }

    if (vehicle !== undefined && vehicle !== serviceRecord.vehicle.toString()) {
      const oldVehicle = await Vehicle.findById(serviceRecord.vehicle).session(session);
      if (oldVehicle && oldVehicle.status === 'SERVICE') {
        oldVehicle.status = 'AVAILABLE';
        await oldVehicle.save({ session });
      }
      const newVehicle = await Vehicle.findById(vehicle).session(session);
      if (newVehicle) {
        newVehicle.status = 'SERVICE';
        await newVehicle.save({ session });
        serviceRecord.vehicle = vehicle;
      }
    }

    if (complaint !== undefined) serviceRecord.complaint = complaint;
    if (inspectionNotes !== undefined) serviceRecord.inspectionNotes = inspectionNotes;
    if (technician !== undefined) serviceRecord.technician = technician;
    
    if (status !== undefined) {
      serviceRecord.status = status;
      if (status === 'Completed' || status === 'Delivered') {
        serviceRecord.completedDate = new Date();
        
        // Revert vehicle back to AVAILABLE when service completes
        const vehicleDoc = await Vehicle.findById(serviceRecord.vehicle).session(session);
        if (vehicleDoc && vehicleDoc.status === 'SERVICE') {
          vehicleDoc.status = 'AVAILABLE';
          await vehicleDoc.save({ session });
        }
      }
    }

    if (paymentStatus !== undefined && paymentStatus !== serviceRecord.paymentStatus) {
      serviceRecord.paymentStatus = paymentStatus;
      if (paymentStatus === 'Paid' && serviceRecord.invoice) {
        const Invoice = require('../invoices/invoice.model');
        const invoiceDoc = await Invoice.findById(serviceRecord.invoice).session(session);
        if (invoiceDoc && invoiceDoc.paymentStatus !== 'Paid') {
          const oldOutstanding = invoiceDoc.outstandingAmount;
          invoiceDoc.paymentStatus = 'Paid';
          invoiceDoc.outstandingAmount = 0;
          await invoiceDoc.save({ session });
          
          const customerDoc = await Customer.findById(serviceRecord.customer).session(session);
          if (customerDoc) {
            customerDoc.balance -= oldOutstanding;
            await customerDoc.save({ session });
          }
        }
      }
    }

    let partsTotal = 0;
    let partsGstAmount = 0;
    const preparedParts = [];

    if (partsUsed !== undefined) {
      if (partsUsed.length > 0) {
        for (const item of partsUsed) {
          const productDoc = await Product.findById(item.product).session(session);
          if (!productDoc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: `Part product ${item.product} not found` });
          }

          const qty = Number(item.quantity || 1);
          const price = Number(item.unitPrice || productDoc.sellingPrice);
          const gstRate = Number(item.gstRate || productDoc.gstRate || 18);

          const partSubtotal = qty * price;
          const partGst = partSubtotal * (gstRate / 100);
          const partTotal = partSubtotal + partGst;

          partsTotal += partSubtotal;
          partsGstAmount += partGst;

          preparedParts.push({
            product: item.product,
            quantity: qty,
            unitPrice: price,
            gstRate,
            gstAmount: partGst,
            total: partTotal
          });
        }
        serviceRecord.partsUsed = preparedParts;
        serviceRecord.partsTotal = partsTotal;
      } else {
        serviceRecord.partsUsed = [];
        serviceRecord.partsTotal = 0;
      }
    }

    if (labourCharges !== undefined) {
      serviceRecord.labourCharges = Number(labourCharges);
    }

    // Calculations
    const labourVal = serviceRecord.labourCharges;
    const labourGst = labourVal * 0.18; // 18% standard GST on labor charges
    
    serviceRecord.gstAmount = partsGstAmount + labourGst;
    serviceRecord.totalAmount = Math.round(serviceRecord.partsTotal + partsGstAmount + labourVal + labourGst);

    await serviceRecord.save({ session });
    await session.commitTransaction();
    session.endSession();

    await logAudit({
      user: req.user.email,
      action: 'UPDATE',
      entity: 'Service',
      entityId: serviceRecord._id.toString(),
      details: `Updated job card ${serviceRecord.jobCardNo}. Status: ${serviceRecord.status}. Total bill: ${serviceRecord.totalAmount}`,
      beforeData: oldData,
      afterData: serviceRecord.toObject()
    });

    res.json(serviceRecord);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('updateJobCard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteJobCard = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const serviceRecord = await Service.findById(req.params.id).session(session);
    if (!serviceRecord) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Job Card not found' });
    }

    // Revert vehicle status back to AVAILABLE if it was in SERVICE
    if (serviceRecord.vehicle) {
      const vehicleDoc = await Vehicle.findById(serviceRecord.vehicle).session(session);
      if (vehicleDoc && vehicleDoc.status === 'SERVICE') {
        vehicleDoc.status = 'AVAILABLE';
        await vehicleDoc.save({ session });
      }
    }

    // If there's an associated invoice, delete it as well to maintain ledger consistency
    if (serviceRecord.invoice) {
      const Invoice = require('../invoices/invoice.model');
      const invoiceDoc = await Invoice.findById(serviceRecord.invoice).session(session);
      if (invoiceDoc) {
        // Revert customer balance
        const Customer = require('../customers/customer.model');
        const customerDoc = await Customer.findById(invoiceDoc.customer).session(session);
        if (customerDoc) {
          customerDoc.balance = Math.max(0, customerDoc.balance - invoiceDoc.outstandingAmount);
          await customerDoc.save({ session });
        }
        await Invoice.deleteOne({ _id: serviceRecord.invoice }).session(session);
      }
    }

    await Service.deleteOne({ _id: req.params.id }).session(session);

    await session.commitTransaction();
    session.endSession();

    await logAudit({
      user: req.user.email,
      action: 'DELETE',
      entity: 'Service',
      entityId: req.params.id,
      details: `Deleted job card ${serviceRecord.jobCardNo} for customer`,
      beforeData: serviceRecord.toObject()
    });

    res.json({ message: 'Service Job Card deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('deleteJobCard error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const generateInvoiceFromService = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const serviceRecord = await Service.findById(req.params.id)
      .populate('customer')
      .populate('vehicle')
      .populate('partsUsed.product')
      .session(session);
      
    if (!serviceRecord) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Job Card not found' });
    }
    
    if (serviceRecord.invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Invoice already generated for this service job card' });
    }
    
    const Customer = require('../customers/customer.model');
    const Invoice = require('../invoices/invoice.model');
    
    const customerDoc = await Customer.findById(serviceRecord.customer).session(session);
    if (!customerDoc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check interstate vs intrastate GST split
    // Intra-state standard prefix '08' for Rajasthan.
    const placeOfSupply = customerDoc.gstin && customerDoc.gstin.startsWith('08') ? 'Rajasthan' : 'Out of State';
    const isInterState = placeOfSupply !== 'Rajasthan';
    
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let totalAmount = 0;
    
    const preparedItems = [];
    
    // Add spare parts
    for (const item of serviceRecord.partsUsed) {
      const productDoc = item.product; // populated
      const qty = Number(item.quantity || 1);
      const price = Number(item.unitPrice || productDoc.sellingPrice);
      const gstRate = Number(item.gstRate || productDoc.gstRate || 18);
      
      const itemTaxable = qty * price;
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
        product: productDoc._id,
        name: productDoc.name,
        price,
        quantity: qty,
        discount: 0,
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
    
    // Add labour charges if > 0
    if (serviceRecord.labourCharges > 0) {
      const labourVal = serviceRecord.labourCharges;
      const gstRate = 18; // 18% standard GST on labour
      const itemGst = labourVal * 0.18;
      const itemTotal = labourVal + itemGst;
      
      taxableAmount += labourVal;
      
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
        product: null,
        name: 'Labour Charges',
        price: labourVal,
        quantity: 1,
        discount: 0,
        taxable: labourVal,
        cgstRate,
        cgstAmount: cgstVal,
        sgstRate,
        sgstAmount: sgstVal,
        igstRate,
        igstAmount: igstVal,
        total: itemTotal
      });
    }
    
    const finalTotal = Math.round(totalAmount);
    const roundOff = Number((finalTotal - totalAmount).toFixed(2));
    
    // Require generateNextInvoiceNumber function
    const { generateNextInvoiceNumber } = require('../invoices/invoice.controller');
    const invoiceNo = await generateNextInvoiceNumber();
    
    const invoice = new Invoice({
      invoiceNo,
      invoiceDate: new Date(),
      customer: serviceRecord.customer,
      serviceJob: serviceRecord._id,
      items: preparedItems,
      discountAmount: 0,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      roundOff,
      totalAmount: finalTotal,
      outstandingAmount: 0,
      paymentStatus: 'Paid',
      status: 'ACTIVE',
      placeOfSupply: isInterState ? 'Out of State' : 'Rajasthan'
    });
    
    await invoice.save({ session });
    
    // Link to service card
    serviceRecord.invoice = invoice._id;
    serviceRecord.paymentStatus = 'Paid';
    await serviceRecord.save({ session });
    
    // Update customer outstanding receivable balance
    customerDoc.balance += invoice.outstandingAmount; // Adds 0 since invoice is Paid
    await customerDoc.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'Invoice',
      entityId: invoice._id.toString(),
      details: `Generated service invoice: ${invoiceNo} for customer ${customerDoc.name}. Total: ${finalTotal}`,
      afterData: invoice.toObject()
    });
    
    res.status(201).json(invoice);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('generateInvoiceFromService error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = {
  getJobCards,
  getJobCardById,
  createJobCard,
  updateJobCard,
  deleteJobCard,
  generateInvoiceFromService
};
