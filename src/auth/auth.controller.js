const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../users/user.model');
const { logAudit } = require('../utils/audit');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'mercury_ev_dealership_jwt_secret_key_2026', {
    expiresIn: '30d'
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'Invalid credentials or account suspended' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Log the successful login
    await logAudit({
      user: user.email,
      action: 'LOGIN',
      entity: 'User',
      entityId: user._id.toString(),
      details: 'Admin user logged in successfully'
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || 'admin',
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getMe = async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  login,
  getMe
};
