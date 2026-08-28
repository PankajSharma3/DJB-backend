const TestDrive = require('./test_drive.model');
const Vehicle = require('../vehicles/vehicle.model');
const { logAudit } = require('../utils/audit');

const getTestDrives = async (req, res) => {
  try {
    const testDrives = await TestDrive.find().populate('vehicle').sort({ date: -1 });
    res.json(testDrives);
  } catch (error) {
    console.error('getTestDrives error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createTestDrive = async (req, res) => {
  try {
    const { customer, phone, licenseNo, vehicle, date, startKm } = req.body;
    
    if (!customer || !phone || !licenseNo || !vehicle || startKm === undefined) {
      return res.status(400).json({ message: 'Please provide customer name, phone, license, vehicle unit, and start KM' });
    }

    const vehicleDoc = await Vehicle.findById(vehicle);
    if (!vehicleDoc) {
      return res.status(404).json({ message: 'Vehicle unit not found' });
    }

    const testDrive = new TestDrive({
      customer,
      phone,
      licenseNo,
      vehicle,
      date: date || new Date(),
      startKm: Number(startKm),
      status: 'Scheduled'
    });

    await testDrive.save();

    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'TestDrive',
      entityId: testDrive._id.toString(),
      details: `Scheduled test drive for customer ${customer} on vehicle chassis ${vehicleDoc.chassisNo}`
    });

    res.status(201).json(testDrive);
  } catch (error) {
    console.error('createTestDrive error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const completeTestDrive = async (req, res) => {
  try {
    const { endKm, feedback } = req.body;
    
    if (endKm === undefined) {
      return res.status(400).json({ message: 'Please provide end KM reading' });
    }

    const testDrive = await TestDrive.findById(req.params.id);
    if (!testDrive) {
      return res.status(404).json({ message: 'Test drive not found' });
    }

    if (testDrive.status !== 'Scheduled') {
      return res.status(400).json({ message: `Test drive is already ${testDrive.status}` });
    }

    if (Number(endKm) < testDrive.startKm) {
      return res.status(400).json({ message: `End KM (${endKm}) cannot be less than Start KM (${testDrive.startKm})` });
    }

    const oldData = testDrive.toObject();
    testDrive.endKm = Number(endKm);
    testDrive.feedback = feedback || '';
    testDrive.status = 'Completed';
    
    await testDrive.save();

    await logAudit({
      user: req.user.email,
      action: 'UPDATE',
      entity: 'TestDrive',
      entityId: testDrive._id.toString(),
      details: `Completed test drive for customer ${testDrive.customer}. Distance: ${testDrive.endKm - testDrive.startKm} KM`,
      beforeData: oldData,
      afterData: testDrive.toObject()
    });

    res.json(testDrive);
  } catch (error) {
    console.error('completeTestDrive error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getTestDrives,
  createTestDrive,
  completeTestDrive
};
