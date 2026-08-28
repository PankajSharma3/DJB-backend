const SalesOrder = require('./sales_order.model');
const Vehicle = require('../vehicles/vehicle.model');
const Customer = require('../customers/customer.model');
const Product = require('../products/product.model');
const { logAudit } = require('../utils/audit');
const mongoose = require('mongoose');

const getBookings = async (req, res) => {
  try {
    const bookings = await SalesOrder.find()
      .populate('customer')
      .populate('product')
      .populate('vehicle')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error('getBookings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { customer, product, vehicle, reservationAmount, expiryDays } = req.body;
    
    if (!customer || !product || !reservationAmount) {
      return res.status(400).json({ message: 'Please provide customer, product model, and reservation amount' });
    }
    
    // Check if customer exists
    const customerDoc = await Customer.findById(customer).session(session);
    if (!customerDoc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check product
    const productDoc = await Product.findById(product).session(session);
    if (!productDoc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Product not found' });
    }

    let vehicleId = null;
    if (vehicle) {
      const vehicleDoc = await Vehicle.findById(vehicle).session(session);
      if (!vehicleDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Selected vehicle unit not found' });
      }
      
      if (vehicleDoc.status !== 'AVAILABLE') {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: `Vehicle ${vehicleDoc.chassisNo} is not available (Current status: ${vehicleDoc.status})` });
      }

      vehicleId = vehicleDoc._id;
      vehicleDoc.status = 'RESERVED';
      vehicleDoc.customer = customerDoc._id;
      await vehicleDoc.save({ session });
    }

    const reservationNo = 'RES-' + Date.now();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (Number(expiryDays) || 7)); // Default 7 days reservation

    const salesOrder = new SalesOrder({
      reservationNo,
      customer,
      product,
      vehicle: vehicleId,
      reservationAmount: Number(reservationAmount),
      expiryDate,
      status: 'CONFIRMED'
    });

    await salesOrder.save({ session });
    await session.commitTransaction();
    session.endSession();

    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'SalesOrder',
      entityId: salesOrder._id.toString(),
      details: `Created vehicle booking: ${reservationNo} for customer: ${customerDoc.name}. Amount: ${reservationAmount}`,
      afterData: salesOrder.toObject()
    });

    res.status(201).json(salesOrder);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('createBooking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await SalesOrder.findById(req.params.id).session(session);
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status === 'CANCELLED' || booking.status === 'INVOICED') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: `Booking status is already ${booking.status}` });
    }

    const oldData = booking.toObject();
    booking.status = 'CANCELLED';
    await booking.save({ session });

    // Release vehicle if one was assigned
    if (booking.vehicle) {
      const vehicle = await Vehicle.findById(booking.vehicle).session(session);
      if (vehicle) {
        vehicle.status = 'AVAILABLE';
        vehicle.customer = null;
        await vehicle.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    await logAudit({
      user: req.user.email,
      action: 'UPDATE',
      entity: 'SalesOrder',
      entityId: booking._id.toString(),
      details: `Cancelled booking: ${booking.reservationNo}. Vehicle released back to available stock.`,
      beforeData: oldData,
      afterData: booking.toObject()
    });

    res.json(booking);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('cancelBooking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getBookings,
  createBooking,
  cancelBooking
};
