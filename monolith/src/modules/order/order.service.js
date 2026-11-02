const orderRepository = require('./order.repository');
const catalogService = require('../catalog/catalog.service');
const inventoryService = require('../inventory/inventory.service');
const TaxEngine = require('./tax.engine');

class OrderService {
  /**
   * Cart Management
   */
  async getCart(cartId, locationCode = 'DEFAULT') {
    const cart = orderRepository.getCart(cartId);
    let subtotal = 0;
    const enrichedItems = [];

    for (const item of cart.items) {
      const product = await catalogService.getProductById(item.productId);
      const lineTotal = Number((product.price * item.quantity).toFixed(2));
      subtotal += lineTotal;
      enrichedItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        lineTotal
      });
    }

    const taxCalculation = TaxEngine.calculateTax(subtotal, locationCode || cart.locationCode);

    return {
      cartId: cart.id,
      items: enrichedItems,
      itemCount: enrichedItems.reduce((acc, i) => acc + i.quantity, 0),
      subtotal: Number(subtotal.toFixed(2)),
      tax: taxCalculation,
      totalAmount: taxCalculation.totalAmount,
      locationCode: taxCalculation.jurisdiction
    };
  }

  async addItemToCart(cartId, productId, quantity = 1) {
    if (quantity <= 0) throw new Error('Quantity must be greater than 0');
    // Boundary check: verify product existence via catalog module
    const product = await catalogService.getProductById(productId);
    // Boundary check: check available inventory via inventory module
    const inv = await inventoryService.getInventoryByProductId(productId);
    if (inv.stockAvailable < quantity) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${inv.stockAvailable}`);
    }

    const cart = orderRepository.getCart(cartId);
    const existingIndex = cart.items.findIndex(i => i.productId === productId);
    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({ productId, quantity });
    }

    orderRepository.saveCart(cart);
    return this.getCart(cart.id, cart.locationCode);
  }

  async removeItemFromCart(cartId, productId) {
    const cart = orderRepository.getCart(cartId);
    cart.items = cart.items.filter(i => i.productId !== productId);
    orderRepository.saveCart(cart);
    return this.getCart(cart.id, cart.locationCode);
  }

  /**
   * Checkout Flow with Sprint 3 Features:
   * 1. 5-Minute Inventory Reservation Lock
   * 2. Dynamic Tax Engine location-based calculation
   */
  async checkout(cartId, checkoutData = {}) {
    const { customerId = 'cust-01', locationCode = 'DEFAULT', shippingAddress = {} } = checkoutData;
    const effectiveLocation = shippingAddress.state ? `US-${shippingAddress.state.toUpperCase()}` : locationCode;

    const cart = await this.getCart(cartId, effectiveLocation);
    if (cart.items.length === 0) {
      throw new Error('Cannot checkout with an empty cart');
    }

    // 1. Calculate dynamic tax for the order
    const taxCalculation = TaxEngine.calculateTax(cart.subtotal, effectiveLocation);

    // 2. Create the pending order
    const orderItems = cart.items.map(i => ({
      productId: i.productId,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      lineTotal: i.lineTotal
    }));

    const order = orderRepository.createOrder({
      customerId,
      items: orderItems,
      subtotal: cart.subtotal,
      taxDetails: taxCalculation,
      totalAmount: taxCalculation.totalAmount,
      status: 'PENDING',
      shippingAddress: {
        ...shippingAddress,
        locationCode: taxCalculation.jurisdiction
      }
    });

    // 3. Sprint 3 Injection: Lock inventory for 5 minutes (300 seconds)
    try {
      const reservation = await inventoryService.reserveStock(order.id, cart.items, 300);
      
      // Update order with reservation lock reference and expiry timestamp
      order.reservationId = reservation.id;
      order.reservationExpiresAt = reservation.expiresAt;
      orderRepository.updateOrder(order.id, {
        status: 'PENDING',
        reservationId: reservation.id,
        reservationExpiresAt: reservation.expiresAt
      });

      // Clear the user's cart
      orderRepository.clearCart(cartId);

      return {
        orderId: order.id,
        status: order.status,
        subtotal: order.subtotal,
        tax: order.taxDetails,
        totalAmount: order.totalAmount,
        items: order.items,
        reservationLock: {
          reservationId: reservation.id,
          status: 'LOCKED',
          ttlSeconds: 300,
          expiresAt: reservation.expiresAt,
          note: 'Stock reserved for 5 minutes. Please complete payment before expiry.'
        }
      };
    } catch (err) {
      // If stock reservation fails, mark order as FAILED
      orderRepository.updateOrderStatus(order.id, 'FAILED_INSUFFICIENT_STOCK');
      throw new Error(`Checkout failed: ${err.message}`);
    }
  }

  /**
   * Process payment for an order
   */
  async processPayment(orderId, paymentData = {}) {
    const order = orderRepository.findOrderById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    if (order.status === 'PAID') {
      return { success: true, message: 'Order is already paid', order };
    }
    if (order.status !== 'PENDING') {
      throw new Error(`Order cannot be paid in current status: ${order.status}`);
    }

    // Check if 5-minute reservation has expired
    if (order.reservationId) {
      const resStatus = await inventoryService.getReservationStatus(order.reservationId);
      if (resStatus.status === 'EXPIRED' || resStatus.isExpired) {
        orderRepository.updateOrderStatus(order.id, 'EXPIRED');
        throw new Error('Payment rejected: 5-minute stock reservation expired. Inventory has been released.');
      }

      // Confirm reservation to permanently deduct stock
      await inventoryService.confirmReservation(order.reservationId);
    }

    const updatedOrder = orderRepository.updateOrderStatus(orderId, 'PAID', {
      transactionId: `txn-${Date.now()}`,
      method: paymentData.method || 'CREDIT_CARD',
      amount: order.totalAmount,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Payment processed successfully and order confirmed',
      order: updatedOrder
    };
  }

  async getOrderById(orderId) {
    const order = orderRepository.findOrderById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    return order;
  }

  async getAllOrders() {
    return orderRepository.findAllOrders();
  }

  async cancelOrder(orderId, reason = 'CUSTOMER_CANCELLED') {
    const order = orderRepository.findOrderById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status === 'PAID') {
      throw new Error('Cannot cancel an already paid order via this endpoint');
    }

    if (order.reservationId) {
      await inventoryService.releaseReservation(order.reservationId, reason);
    }

    const updated = orderRepository.updateOrderStatus(orderId, 'CANCELLED');
    return { success: true, message: 'Order cancelled and stock released', order: updated };
  }
}

module.exports = new OrderService();
