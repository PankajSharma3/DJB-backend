const express = require('express');
const router = express.Router();
const { getVehicles, getVehicleById, receiveVehicle, updateVehicle, adjustStock } = require('./vehicle.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getVehicles)
  .post(receiveVehicle);

router.post('/adjust', adjustStock);

router.route('/:id')
  .get(getVehicleById)
  .put(updateVehicle);

module.exports = router;
