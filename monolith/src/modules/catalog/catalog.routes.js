const express = require('express');
const router = express.Router();
const catalogController = require('./catalog.controller');

router.get('/', (req, res) => catalogController.getProducts(req, res));
router.get('/:id', (req, res) => catalogController.getProductById(req, res));
router.post('/', (req, res) => catalogController.createProduct(req, res));
router.put('/:id', (req, res) => catalogController.updateProduct(req, res));
router.delete('/:id', (req, res) => catalogController.deleteProduct(req, res));

module.exports = router;
