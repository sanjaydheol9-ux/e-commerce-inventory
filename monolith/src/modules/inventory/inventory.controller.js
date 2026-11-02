const inventoryService = require('./inventory.service');

class InventoryController {
  async getAll(req, res) {
    try {
      const data = await inventoryService.getAllInventory();
      res.json({ success: true, count: data.length, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getByProductId(req, res) {
    try {
      const data = await inventoryService.getInventoryByProductId(req.params.productId);
      res.json({ success: true, data });
    } catch (err) {
      res.status(404).json({ success: false, error: err.message });
    }
  }

  async updateStock(req, res) {
    try {
      const { stockAvailable, lowStockThreshold } = req.body;
      const data = await inventoryService.setStock(req.params.productId, stockAvailable, lowStockThreshold);
      res.json({ success: true, message: 'Stock updated', data });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // Reservation endpoints
  async reserve(req, res) {
    try {
      const { orderId, items, ttlSeconds } = req.body;
      const reservation = await inventoryService.reserveStock(orderId, items, ttlSeconds);
      res.status(201).json({ success: true, message: 'Stock locked for 5 minutes', data: reservation });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async confirmReservation(req, res) {
    try {
      const result = await inventoryService.confirmReservation(req.params.id);
      res.json({ success: true, message: 'Reservation confirmed', data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async releaseReservation(req, res) {
    try {
      const { reason } = req.body || {};
      const result = await inventoryService.releaseReservation(req.params.id, reason || 'MANUAL_CANCEL');
      res.json({ success: true, message: 'Reservation released and stock restored', data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async getReservation(req, res) {
    try {
      const data = await inventoryService.getReservationStatus(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      res.status(404).json({ success: false, error: err.message });
    }
  }

  async triggerSweep(req, res) {
    try {
      const count = inventoryService.sweepExpiredReservations();
      res.json({ success: true, message: `Swept ${count} expired reservation(s)`, sweptCount: count });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new InventoryController();
