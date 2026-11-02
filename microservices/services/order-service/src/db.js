const fs = require('fs');
const path = require('path');

class OrderDB {
  constructor(filePath) {
    this.filePath = filePath || path.join(__dirname, '../data/order_db.json');
    this.orders = [];
    this.carts = [];
    this.init();
  }

  init() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.orders = parsed.orders || [];
        this.carts = parsed.carts || [];
      } catch (e) {
        this.orders = [];
        this.carts = [];
        this.save();
      }
    } else {
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify({
        orders: this.orders,
        carts: this.carts
      }, null, 2), 'utf8');
    } catch (err) {
      console.error('[OrderDB] Save error:', err.message);
    }
  }

  getCart(cartId) {
    let cart = this.carts.find(c => c.id === cartId);
    if (!cart) {
      cart = { id: cartId, items: [], locationCode: 'DEFAULT', createdAt: new Date().toISOString() };
      this.carts.push(cart);
      this.save();
    }
    return cart;
  }

  saveCart(cart) {
    const idx = this.carts.findIndex(c => c.id === cart.id);
    if (idx > -1) {
      this.carts[idx] = cart;
    } else {
      this.carts.push(cart);
    }
    this.save();
    return cart;
  }

  clearCart(cartId) {
    const cart = this.getCart(cartId);
    cart.items = [];
    this.saveCart(cart);
  }

  createOrder(order) {
    this.orders.push(order);
    this.save();
    return order;
  }

  findOrderById(id) {
    return this.orders.find(o => o.id === id) || null;
  }

  getAllOrders() {
    return this.orders;
  }

  updateOrder(id, updates) {
    const order = this.findOrderById(id);
    if (!order) return null;
    Object.assign(order, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return order;
  }
}

module.exports = new OrderDB();
