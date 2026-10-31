const Vehicle = require('./vehicle.model');
const Product = require('../products/product.model');
const { logAudit } = require('../utils/audit');

const getVehicles = async (req, res) => {
  try {
    const { status, product } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (product) filter.product = product;
    
    const vehicles = await Vehicle.find(filter)
      .populate('product')
      .populate('customer', 'name phone')
      .sort({ createdAt: -1 })
      .lean();
    res.json(vehicles);
  } catch (error) {
    console.error('getVehicles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getVehicleById = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate('product')
      .populate('customer')
      .lean();
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    res.json(vehicle);
  } catch (error) {
    console.error('getVehicleById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const receiveVehicle = async (req, res) => {
  try {
    const { chassisNo, motorNo, batteryNo, product, color, status, costPrice, sellingPrice, location, controllerNo, chargerNo, controllerNumber, chargerNumber } = req.body;
    
    if (!chassisNo || !motorNo || !batteryNo || !product || !color) {
      return res.status(400).json({ message: 'Please provide all required identifiers and product model' });
    }
    
    // Check duplicates
    const duplicateChassis = await Vehicle.findOne({ chassisNo });
    if (duplicateChassis) return res.status(400).json({ message: `Chassis number ${chassisNo} already exists in inventory` });
    
    const duplicateMotor = await Vehicle.findOne({ motorNo });
    if (duplicateMotor) return res.status(400).json({ message: `Motor number ${motorNo} already exists in inventory` });
    
    const duplicateBattery = await Vehicle.findOne({ batteryNo });
    if (duplicateBattery) return res.status(400).json({ message: `Battery number ${batteryNo} already exists in inventory` });

    const selectedProduct = await Product.findById(product);
    if (!selectedProduct || selectedProduct.type !== 'Vehicle') {
      return res.status(400).json({ message: 'Invalid product or product is not a vehicle model' });
    }

    const finalControllerNo = (controllerNo || controllerNumber || selectedProduct.controllerNo || '').toString().trim().toUpperCase();
    const finalChargerNo = (chargerNo || chargerNumber || selectedProduct.chargerNo || '').toString().trim().toUpperCase();

    const vehicle = new Vehicle({
      chassisNo: chassisNo.toString().trim().toUpperCase(),
      motorNo: motorNo.toString().trim().toUpperCase(),
      batteryNo: batteryNo.toString().trim().toUpperCase(),
      product,
      color: color.toString().trim(),
      controllerNo: finalControllerNo,
      chargerNo: finalChargerNo,
      status: status || 'AVAILABLE',
      costPrice: costPrice || selectedProduct.purchasePrice,
      sellingPrice: sellingPrice || selectedProduct.sellingPrice,
      location: location || 'Main Branch'
    });
    
    await vehicle.save();
    
    await logAudit({
      user: req.user.email,
      action: 'STOCK_RECEIPT',
      entity: 'Vehicle',
      entityId: vehicle._id.toString(),
      details: `Received EV Stock. Chassis: ${chassisNo}, Model: ${selectedProduct.name}`,
      afterData: vehicle.toObject()
    });
    
    res.status(201).json(vehicle);
  } catch (error) {
    console.error('receiveVehicle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    
    // Check duplicates if identifiers are updated
    if (req.body.chassisNo && req.body.chassisNo !== vehicle.chassisNo) {
      const duplicate = await Vehicle.findOne({ chassisNo: req.body.chassisNo });
      if (duplicate) return res.status(400).json({ message: 'Duplicate Chassis Number' });
    }
    if (req.body.motorNo && req.body.motorNo !== vehicle.motorNo) {
      const duplicate = await Vehicle.findOne({ motorNo: req.body.motorNo });
      if (duplicate) return res.status(400).json({ message: 'Duplicate Motor Number' });
    }
    if (req.body.batteryNo && req.body.batteryNo !== vehicle.batteryNo) {
      const duplicate = await Vehicle.findOne({ batteryNo: req.body.batteryNo });
      if (duplicate) return res.status(400).json({ message: 'Duplicate Battery Number' });
    }
    
    const oldData = vehicle.toObject();
    Object.assign(vehicle, req.body);
    await vehicle.save();
    
    await logAudit({
      user: req.user.email,
      action: 'UPDATE',
      entity: 'Vehicle',
      entityId: vehicle._id.toString(),
      details: `Updated vehicle chassis ${vehicle.chassisNo}. Status updated to: ${vehicle.status}`,
      beforeData: oldData,
      afterData: vehicle.toObject()
    });
    
    res.json(vehicle);
  } catch (error) {
    console.error('updateVehicle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const adjustStock = async (req, res) => {
  try {
    const { vehicleId, reason, newStatus } = req.body;
    if (!vehicleId || !reason || !newStatus) {
      return res.status(400).json({ message: 'Please provide vehicle ID, reason, and new status' });
    }
    
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    
    const oldData = vehicle.toObject();
    vehicle.status = newStatus;
    await vehicle.save();
    
    await logAudit({
      user: req.user.email,
      action: 'STOCK_ADJUST',
      entity: 'Vehicle',
      entityId: vehicle._id.toString(),
      details: `Manual Stock Adjustment. Reason: ${reason}. Status: ${oldData.status} -> ${newStatus}`,
      beforeData: oldData,
      afterData: vehicle.toObject()
    });
    
    res.json(vehicle);
  } catch (error) {
    console.error('adjustStock error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getVehicles,
  getVehicleById,
  receiveVehicle,
  updateVehicle,
  adjustStock
};
