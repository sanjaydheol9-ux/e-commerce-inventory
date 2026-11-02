const { monolithDb } = require('../../database/db');
const { v4: uuidv4 } = require('uuid');

class OrderRepository {
  constructor(db = monolithDb) {
    this.db = db;
  }

  // Cart operations
  getCart(cartId) {
    let cart = this.db.findById('carts', cartId);
    if (!cart) {
      cart = this.db.insert('carts', {
        id: cartId || `cart-${uuidv4().substring(0, 8)}`,
        items: [],
        locationCode: 'DEFAULT',
        createdAt: new Date().toISOString()
      });
    }
    return cart;
  }

  saveCart(cart) {
    const existing = this.db.findById('carts', cart.id);
    if (existing) {
      return this.db.update('carts', cart.id, cart);
    }
    return this.db.insert('carts', cart);
  }

  clearCart(cartId) {
    return this.db.update('carts', cartId, { items: [] });
  }

  // Order operations
  createOrder(orderData) {
    const order = {
      id: orderData.id || `ord-${uuidv4().substring(0, 8)}`,
      customerId: orderData.customerId || 'guest',
      items: orderData.items,
      subtotal: orderData.subtotal,
      taxDetails: orderData.taxDetails,
      totalAmount: orderData.totalAmount,
      status: orderData.status || 'PENDING', // PENDING, PAID, CANCELLED, EXPIRED
      reservationId: orderData.reservationId || null,
      reservationExpiresAt: orderData.reservationExpiresAt || null,
      shippingAddress: orderData.shippingAddress || {},
      paymentDetails: orderData.paymentDetails || null,
      createdAt: new Date().toISOString()
    };
    return this.db.insert('orders', order);
  }

  findOrderById(id) {
    return this.db.findById('orders', id);
  }

  findAllOrders() {
    return this.db.find('orders');
  }

  updateOrderStatus(id, status, paymentDetails = null) {
    const updates = { status };
    if (paymentDetails) {
      updates.paymentDetails = paymentDetails;
      updates.paidAt = new Date().toISOString();
    }
    return this.db.update('orders', id, updates);
  }

  updateOrder(id, updates) {
    return this.db.update('orders', id, updates);
  }
}

module.exports = new OrderRepository();
