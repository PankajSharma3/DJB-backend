const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/djb_ev_world';
    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: 25, // Maintain up to 25 socket connections
      minPoolSize: 5,  // Keep at least 5 sockets warm and ready
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      family: 4 // Use IPv4 to avoid IPv6 resolution delays
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
