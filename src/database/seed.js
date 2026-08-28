const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../users/user.model');
const Company = require('../company/company.model');
const Product = require('../products/product.model');
const Vehicle = require('../vehicles/vehicle.model');
const Customer = require('../customers/customer.model');
const Supplier = require('../suppliers/supplier.model');
const Purchase = require('../purchases/purchase.model');
const Invoice = require('../invoices/invoice.model');
const Payment = require('../payments/payment.model');
const Expense = require('../expenses/expense.model');
const Service = require('../service/service.model');
const Lead = require('../leads/lead.model');
const TestDrive = require('../test-drives/test_drive.model');
const AuditLog = require('../audit/audit_log.model');

const seedDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/djb_ev_world';
    console.log('Connecting to MongoDB for seeding at:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected to Database. Clearing collections...');

    // Clear all existing data
    await User.deleteMany({});
    await Company.deleteMany({});
    await Product.deleteMany({});
    await Vehicle.deleteMany({});
    await Customer.deleteMany({});
    await Supplier.deleteMany({});
    await Purchase.deleteMany({});
    await Invoice.deleteMany({});
    await Payment.deleteMany({});
    await Expense.deleteMany({});
    await Service.deleteMany({});
    await Lead.deleteMany({});
    await TestDrive.deleteMany({});
    await AuditLog.deleteMany({});

    console.log('Collections cleared. Seeding Admin User...');
    
    // Hash password
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@djbevworld.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const admin = new User({
      name: 'Super Admin',
      email: adminEmail,
      password: hashedPassword,
      status: 'active'
    });
    await admin.save();
    console.log(`Admin User seeded: ${adminEmail}`);

    console.log('Seeding Company Settings (D.J.B. EV WORLD)...');
    const company = new Company({
      legalName: 'D.J.B. EV WORLD',
      tradeName: 'D.J.B. EV WORLD',
      pan: 'ABAFD2540H',
      gstin: '08ABAFD2540H1ZS',
      address: {
        floorNo: 'FATEHPUR SHEKHAWATI',
        buildingNo: 'CHURU BYPASS',
        buildingName: 'NEAR MOTI PALACE HOTEL',
        street: 'NEAR MOTI PALACE HOTEL',
        landmark: 'N.H.52',
        locality: 'N.H.52, CHURU BYPASS',
        city: 'Fatehpur',
        district: 'Sikar',
        state: 'Rajasthan',
        pinCode: '332301'
      },
      bankDetails: {
        bankName: 'State Bank of India',
        accountNo: '39485768291',
        ifsc: 'SBIN0001234',
        branchName: 'Fatehpur Branch'
      },
      upiId: 'djbevworld@sbi',
      logoUrl: '/mercury_ev_tech_logo.jpg',
      invoicePrefix: 'DJB',
      invoiceSuffix: '/26-27/'
    });
    await company.save();
    console.log('Company Settings seeded.');

    console.log('Seeding Products (Vehicles and Spare Parts)...');
    
    const vehiclesData = [
      { name: 'EZ Highspeed', type: 'Vehicle', category: 'Two Wheeler', hsnCode: '8711', gstRate: 5, purchasePrice: 70000, sellingPrice: 85000, minStock: 2 },
      { name: 'DLX', type: 'Vehicle', category: 'Two Wheeler', hsnCode: '8711', gstRate: 5, purchasePrice: 85000, sellingPrice: 105000, minStock: 2 },
      { name: 'Limosa', type: 'Vehicle', category: 'Two Wheeler', hsnCode: '8711', gstRate: 5, purchasePrice: 120000, sellingPrice: 145000, minStock: 1 },
      { name: 'Mushak', type: 'Vehicle', category: 'Three Wheeler Cargo', hsnCode: '8711', gstRate: 5, purchasePrice: 180000, sellingPrice: 220000, minStock: 1 }
    ];
    
    const partsData = [
      { name: 'Lithium Battery 60V 30Ah', type: 'Spare Part', category: 'Battery', hsnCode: '8507', gstRate: 18, purchasePrice: 25000, sellingPrice: 32000, minStock: 5 },
      { name: 'EV Motor Controller', type: 'Spare Part', category: 'Electronics', hsnCode: '8537', gstRate: 18, purchasePrice: 4000, sellingPrice: 6500, minStock: 3 },
      { name: 'Disc Brake Pad', type: 'Spare Part', category: 'Brakes', hsnCode: '8714', gstRate: 28, purchasePrice: 200, sellingPrice: 450, minStock: 10 }
    ];

    const accessoriesData = [
      { name: 'EV Smart Charger', type: 'Accessory', category: 'Chargers', hsnCode: '8504', gstRate: 18, purchasePrice: 2200, sellingPrice: 3800, minStock: 4 },
      { name: 'Premium Helmet', type: 'Accessory', category: 'Safety', hsnCode: '6506', gstRate: 18, purchasePrice: 800, sellingPrice: 1500, minStock: 5 }
    ];

    const seededProducts = [];
    
    for (const p of [...vehiclesData, ...partsData, ...accessoriesData]) {
      const prod = new Product(p);
      await prod.save();
      seededProducts.push(prod);
    }
    console.log('Products seeded.');

    console.log('Seeding Customers and Suppliers...');
    const customer = new Customer({
      name: 'Ramesh Kumar Saini',
      phone: '9876543210',
      email: 'ramesh.saini@gmail.com',
      pan: 'ABCDE1234F',
      address: 'Ward No. 12, Near Bus Stand, Fatehpur, Rajasthan, 332301',
      balance: 0
    });
    await customer.save();

    const customer2 = new Customer({
      name: 'Maharshi Motors Pvt Ltd',
      phone: '9123456789',
      email: 'sales@maharshimotors.com',
      pan: 'AABCM9012G',
      gstin: '08AABCM9012G1Z2',
      address: 'Churu Bypass Road, Fatehpur, Rajasthan, 332301',
      balance: 0
    });
    await customer2.save();

    const supplier = new Supplier({
      name: 'Mercury EV Tech Ltd (HQ)',
      phone: '8989898989',
      email: 'dealer.support@mercuryevtech.com',
      pan: 'AAACM9988H',
      gstin: '24AAACM9988H1ZS', // Gujarat State Code 24
      address: 'Mercury EV Tech Factory, Vadodara, Gujarat, 390001',
      balance: 0
    });
    await supplier.save();
    console.log('Customers and Suppliers seeded.');

    console.log('Seeding Vehicles Stock...');
    const ev1Product = seededProducts.find(p => p.name === 'DLX');
    const ev2Product = seededProducts.find(p => p.name === 'Limosa');

    const vehicle1 = new Vehicle({
      chassisNo: 'MEV3DLX198302061A',
      motorNo: 'MOT829302B',
      batteryNo: 'BAT83918239023C',
      product: ev1Product._id,
      color: 'Glossy Black',
      status: 'AVAILABLE',
      purchaseDate: new Date('2026-08-20'),
      costPrice: ev1Product.purchasePrice,
      sellingPrice: ev1Product.sellingPrice,
      location: 'Main Branch'
    });
    await vehicle1.save();

    const vehicle2 = new Vehicle({
      chassisNo: 'MEV3LIM200492812D',
      motorNo: 'MOT920194E',
      batteryNo: 'BAT910283920192F',
      product: ev2Product._id,
      color: 'Pearl White',
      status: 'AVAILABLE',
      purchaseDate: new Date('2026-08-20'),
      costPrice: ev2Product.purchasePrice,
      sellingPrice: ev2Product.sellingPrice,
      location: 'Main Branch'
    });
    await vehicle2.save();
    console.log('Initial vehicle units in stock seeded.');

    console.log('Database Seeding Completed Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding Error:', error);
    process.exit(1);
  }
};

seedDB();
