const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Product = require('./src/products/product.model');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const prods = await Product.find().lean();
  for (const p of prods) {
    console.log({
      _id: p._id.toString(),
      name: p.name,
      color: p.color,
      batteryType: p.batteryType,
      sellingPrice: p.sellingPrice
    });
  }
  process.exit(0);
}
test();

