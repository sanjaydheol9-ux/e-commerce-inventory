const catalogService = require('./catalog.service');

class CatalogController {
  async getProducts(req, res) {
    try {
      const products = await catalogService.getAllProducts(req.query);
      res.json({ success: true, count: products.length, data: products });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getProductById(req, res) {
    try {
      const product = await catalogService.getProductById(req.params.id);
      res.json({ success: true, data: product });
    } catch (err) {
      res.status(404).json({ success: false, error: err.message });
    }
  }

  async createProduct(req, res) {
    try {
      const product = await catalogService.createProduct(req.body);
      res.status(201).json({ success: true, message: 'Product created successfully', data: product });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async updateProduct(req, res) {
    try {
      const updated = await catalogService.updateProduct(req.params.id, req.body);
      res.json({ success: true, message: 'Product updated successfully', data: updated });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async deleteProduct(req, res) {
    try {
      await catalogService.deleteProduct(req.params.id);
      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (err) {
      res.status(404).json({ success: false, error: err.message });
    }
  }
}

module.exports = new CatalogController();
