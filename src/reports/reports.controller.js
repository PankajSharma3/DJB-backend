const Invoice = require('../invoices/invoice.model');
const Purchase = require('../purchases/purchase.model');
const Vehicle = require('../vehicles/vehicle.model');
const Product = require('../products/product.model');
const Customer = require('../customers/customer.model');
const Supplier = require('../suppliers/supplier.model');
const Expense = require('../expenses/expense.model');
const Lead = require('../leads/lead.model');
const AuditLog = require('../audit/audit_log.model');

const getDashboardStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Run all 11 queries in parallel
    const [
      stockStats,
      customerOutstanding,
      supplierOutstanding,
      customerPaid,
      supplierPaid,
      salesToday,
      salesThisMonth,
      totalPurchases,
      totalExpenses,
      lowStockAlerts,
      pendingFollowups
    ] = await Promise.all([
      Vehicle.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Customer.aggregate([
        { $group: { _id: null, total: { $sum: '$balance' } } }
      ]),
      Supplier.aggregate([
        { $group: { _id: null, total: { $sum: '$balance' } } }
      ]),
      Invoice.aggregate([
        { $match: { status: 'ACTIVE' } },
        { $group: { _id: null, total: { $sum: { $subtract: [ "$totalAmount", "$outstandingAmount" ] } } } }
      ]),
      Purchase.aggregate([
        { $group: { _id: null, total: { $sum: { $subtract: [ "$totalAmount", "$outstandingAmount" ] } } } }
      ]),
      Invoice.aggregate([
        { $match: { invoiceDate: { $gte: todayStart }, status: 'ACTIVE' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Invoice.aggregate([
        { $match: { invoiceDate: { $gte: monthStart }, status: 'ACTIVE' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Purchase.aggregate([
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Expense.aggregate([
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Product.find({ 
        type: { $ne: 'Vehicle' }
      }),
      Lead.find({
        'followUps.status': 'Pending'
      }).limit(5)
    ]);

    const statsMap = {
      AVAILABLE: 0,
      RESERVED: 0,
      SOLD: 0,
      DELIVERED: 0,
      RECEIVED: 0,
      SERVICE: 0
    };

    stockStats.forEach(stat => {
      if (statsMap[stat._id] !== undefined) {
        statsMap[stat._id] = stat.count;
      }
    });

    const totalVehicles = statsMap.AVAILABLE + statsMap.RESERVED + statsMap.RECEIVED + statsMap.SERVICE;

    res.json({
      stock: {
        total: totalVehicles,
        available: statsMap.AVAILABLE,
        reserved: statsMap.RESERVED,
        sold: statsMap.SOLD + statsMap.DELIVERED,
        service: statsMap.SERVICE
      },
      receivables: customerOutstanding[0] ? customerOutstanding[0].total : 0,
      payables: supplierOutstanding[0] ? supplierOutstanding[0].total : 0,
      totalPaidSales: customerPaid[0] ? customerPaid[0].total : 0,
      totalPaidPurchases: supplierPaid[0] ? supplierPaid[0].total : 0,
      sales: {
        today: salesToday[0] ? salesToday[0].total : 0,
        month: salesThisMonth[0] ? salesThisMonth[0].total : 0,
        totalPurchases: totalPurchases[0] ? totalPurchases[0].total : 0,
        totalExpenses: totalExpenses[0] ? totalExpenses[0].total : 0
      },
      pendingFollowups,
      lowStockAlerts: lowStockAlerts.slice(0, 5) // Return top 5 spare parts for dashboard
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getGstSalesRegister = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { status: 'ACTIVE' };
    
    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) {
        filter.invoiceDate.$gte = new Date(startDate + 'T00:00:00');
      }
      if (endDate) {
        filter.invoiceDate.$lte = new Date(endDate + 'T23:59:59.999');
      }
    }

    const invoices = await Invoice.find(filter)
      .populate('customer')
      .populate('items.product')
      .sort({ invoiceNo: 1 });

    res.json(invoices);
  } catch (error) {
    console.error('getGstSalesRegister error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getGstPurchaseRegister = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate + 'T00:00:00');
      }
      if (endDate) {
        filter.date.$lte = new Date(endDate + 'T23:59:59.999');
      }
    }

    const purchases = await Purchase.find(filter)
      .populate('supplier')
      .populate('items.product')
      .sort({ date: 1 });

    res.json(purchases);
  } catch (error) {
    console.error('getGstPurchaseRegister error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    console.error('getAuditLogs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getDashboardStats,
  getGstSalesRegister,
  getGstPurchaseRegister,
  getAuditLogs
};
