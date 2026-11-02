const express = require('express');
const router = express.Router();
const inventoryController = require('./inventory.controller');

router.get('/', (req, res) => inventoryController.getAll(req, res));
router.get('/:productId', (req, res) => inventoryController.getByProductId(req, res));
router.put('/:productId', (req, res) => inventoryController.updateStock(req, res));

// Sprint 3 Reservation routes
router.post('/reservations', (req, res) => inventoryController.reserve(req, res));
router.get('/reservations/:id', (req, res) => inventoryController.getReservation(req, res));
router.post('/reservations/:id/confirm', (req, res) => inventoryController.confirmReservation(req, res));
router.post('/reservations/:id/release', (req, res) => inventoryController.releaseReservation(req, res));
router.post('/reservations/sweep', (req, res) => inventoryController.triggerSweep(req, res));

module.exports = router;
