const Expense = require('./expense.model');
const { logAudit } = require('../utils/audit');

const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    console.error('getExpenses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createExpense = async (req, res) => {
  try {
    const { category, date, amount, gstRate, paymentMode, description } = req.body;
    
    if (!category || !amount) {
      return res.status(400).json({ message: 'Please provide expense category and amount' });
    }

    const amt = Number(amount);
    const rate = Number(gstRate || 0);
    const gstVal = amt * (rate / 100);
    const total = amt + gstVal;

    const expense = new Expense({
      category,
      date: date || new Date(),
      amount: amt,
      gstRate: rate,
      gstAmount: gstVal,
      totalAmount: total,
      paymentMode: paymentMode || 'Cash',
      description: description || '',
      approved: true
    });

    await expense.save();

    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'Expense',
      entityId: expense._id.toString(),
      details: `Recorded operational expense: ${category}. Total: ${total}`,
      afterData: expense.toObject()
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('createExpense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getExpenses,
  createExpense
};
