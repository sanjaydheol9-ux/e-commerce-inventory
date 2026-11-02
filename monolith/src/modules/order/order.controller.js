const orderService = require('./order.service');
const TaxEngine = require('./tax.engine');

class OrderController {
  // Cart handlers
  async getCart(req, res) {
    try {
      const { cartId } = req.params;
      const { location } = req.query;
      const cart = await orderService.getCart(cartId, location);
      res.json({ success: true, data: cart });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async addItemToCart(req, res) {
    try {
      const { cartId } = req.params;
      const { productId, quantity } = req.body;
      const cart = await orderService.addItemToCart(cartId, productId, quantity);
      res.json({ success: true, message: 'Item added to cart', data: cart });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async removeItemFromCart(req, res) {
    try {
      const { cartId, productId } = req.params;
      const cart = await orderService.removeItemFromCart(cartId, productId);
      res.json({ success: true, message: 'Item removed from cart', data: cart });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // Tax preview handler
  async getTaxQuote(req, res) {
    try {
      const { subtotal, locationCode } = req.query;
      const quote = TaxEngine.calculateTax(subtotal, locationCode);
      res.json({ success: true, data: quote });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async getSupportedJurisdictions(req, res) {
    res.json({ success: true, data: TaxEngine.getSupportedJurisdictions() });
  }

  // Order & Checkout handlers
  async checkout(req, res) {
    try {
      const { cartId } = req.params;
      const result = await orderService.checkout(cartId, req.body);
      res.status(201).json({ success: true, message: 'Checkout initiated with 5-minute stock lock', data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async payOrder(req, res) {
    try {
      const result = await orderService.processPayment(req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async getOrder(req, res) {
    try {
      const order = await orderService.getOrderById(req.params.id);
      res.json({ success: true, data: order });
    } catch (err) {
      res.status(404).json({ success: false, error: err.message });
    }
  }

  async getAllOrders(req, res) {
    try {
      const orders = await orderService.getAllOrders();
      res.json({ success: true, count: orders.length, data: orders });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async cancelOrder(req, res) {
    try {
      const result = await orderService.cancelOrder(req.params.id, req.body.reason);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = new OrderController();
