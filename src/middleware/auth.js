const jwt = require('jsonwebtoken');
const User = require('../users/user.model');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mercury_ev_dealership_jwt_secret_key_2026');
      
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user || req.user.status !== 'active') {
        return res.status(401).json({ message: 'Not authorized, user inactive or not found' });
      }
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect };
