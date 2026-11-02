const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');

// Cart routes
router.get('/cart/:cartId', (req, res) => orderController.getCart(req, res));
router.post('/cart/:cartId/items', (req, res) => orderController.addItemToCart(req, res));
router.delete('/cart/:cartId/items/:productId', (req, res) => orderController.removeItemFromCart(req, res));
router.post('/cart/:cartId/checkout', (req, res) => orderController.checkout(req, res));

// Tax query routes
router.get('/tax/quote', (req, res) => orderController.getTaxQuote(req, res));
router.get('/tax/jurisdictions', (req, res) => orderController.getSupportedJurisdictions(req, res));

// Order routes
router.get('/orders', (req, res) => orderController.getAllOrders(req, res));
router.get('/orders/:id', (req, res) => orderController.getOrder(req, res));
router.post('/orders/:id/pay', (req, res) => orderController.payOrder(req, res));
router.post('/orders/:id/cancel', (req, res) => orderController.cancelOrder(req, res));

module.exports = router;
