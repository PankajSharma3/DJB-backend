const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Disable HTTP caching completely across all API endpoints
app.set('etag', false);
app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import Routes
const authRoutes = require('./auth/auth.routes');
const companyRoutes = require('./company/company.routes');
const productRoutes = require('./products/product.routes');
const vehicleRoutes = require('./vehicles/vehicle.routes');
const customerRoutes = require('./customers/customer.routes');
const supplierRoutes = require('./suppliers/supplier.routes');
const purchaseRoutes = require('./purchases/purchase.routes');
const salesRoutes = require('./sales/sales.routes');
const quotationRoutes = require('./quotations/quotation.routes');
const invoiceRoutes = require('./invoices/invoice.routes');
const paymentRoutes = require('./payments/payment.routes');
const expenseRoutes = require('./expenses/expense.routes');
const serviceRoutes = require('./service/service.routes');
const leadRoutes = require('./leads/lead.routes');
const testDriveRoutes = require('./test-drives/test_drive.routes');
const reportsRoutes = require('./reports/reports.routes');

// Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/service', serviceRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/test-drives', testDriveRoutes);
app.use('/api/reports', reportsRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'D.J.B. EV World Server running smoothly' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
