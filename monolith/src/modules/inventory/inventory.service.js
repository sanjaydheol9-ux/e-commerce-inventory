const inventoryRepository = require('./inventory.repository');
const { monolithDb } = require('../../database/db');

class InventoryService {
  constructor() {
    this.startExpirySweeper();
  }

  async getAllInventory() {
    const list = inventoryRepository.findAll();
    return list.map(item => ({
      ...item,
      isLowStock: item.stockAvailable <= item.lowStockThreshold
    }));
  }

  async getInventoryByProductId(productId) {
    const inv = inventoryRepository.findByProductId(productId);
    if (!inv) {
      throw new Error(`Inventory not found for product: ${productId}`);
    }
    return {
      ...inv,
      isLowStock: inv.stockAvailable <= inv.lowStockThreshold
    };
  }

  async setStock(productId, stockAvailable, lowStockThreshold) {
    return inventoryRepository.createOrUpdate(productId, stockAvailable, lowStockThreshold);
  }

  /**
   * Sprint 3 Requirement: 5-Minute Stock Reservation Lock
   * When user initiates checkout, reserve stock for 5 minutes.
   */
  async reserveStock(orderId, items, ttlSeconds = 300) {
    return monolithDb.transaction(db => {
      // 1. Verify stock availability for all items
      for (const item of items) {
        const inv = inventoryRepository.findByProductId(item.productId);
        if (!inv) {
          throw new Error(`Item ${item.productId} not found in inventory`);
        }
        if (inv.stockAvailable < item.quantity) {
          throw new Error(`Insufficient stock for product ${item.productId}. Available: ${inv.stockAvailable}, Requested: ${item.quantity}`);
        }
      }

      // 2. Lock inventory: decrement stockAvailable, increment stockReserved
      for (const item of items) {
        const inv = inventoryRepository.findByProductId(item.productId);
        inventoryRepository.updateStock(inv.id, {
          stockAvailable: inv.stockAvailable - item.quantity,
          stockReserved: (inv.stockReserved || 0) + item.quantity
        });
      }

      // 3. Create reservation record with 5-minute expiration
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

      const reservation = inventoryRepository.createReservation({
        orderId,
        items,
        ttlSeconds,
        expiresAt
      });

      console.log(`[Inventory] Reserved stock for Order ${orderId}. Reservation ID: ${reservation.id}, expires at ${expiresAt}`);
      return reservation;
    });
  }

  /**
   * Confirm reservation upon successful payment
   * Deducts permanently from stockReserved
   */
  async confirmReservation(reservationId) {
    return monolithDb.transaction(db => {
      const reservation = inventoryRepository.findReservationById(reservationId);
      if (!reservation) {
        throw new Error(`Reservation ${reservationId} not found`);
      }
      if (reservation.status !== 'ACTIVE') {
        throw new Error(`Reservation is in state ${reservation.status}, cannot confirm`);
      }

      // Remove from stockReserved
      for (const item of reservation.items) {
        const inv = inventoryRepository.findByProductId(item.productId);
        if (inv) {
          inventoryRepository.updateStock(inv.id, {
            stockReserved: Math.max(0, (inv.stockReserved || 0) - item.quantity)
          });
        }
      }

      return inventoryRepository.updateReservation(reservationId, {
        status: 'CONFIRMED',
        confirmedAt: new Date().toISOString()
      });
    });
  }

  /**
   * Release reservation when payment fails or reservation times out (5 minutes elapsed)
   * Restores stock from stockReserved back to stockAvailable
   */
  async releaseReservation(reservationId, reason = 'EXPIRED') {
    return monolithDb.transaction(db => {
      const reservation = inventoryRepository.findReservationById(reservationId);
      if (!reservation) {
        throw new Error(`Reservation ${reservationId} not found`);
      }
      if (reservation.status !== 'ACTIVE') {
        return reservation; // Already handled
      }

      // Restore stock
      for (const item of reservation.items) {
        const inv = inventoryRepository.findByProductId(item.productId);
        if (inv) {
          inventoryRepository.updateStock(inv.id, {
            stockAvailable: inv.stockAvailable + item.quantity,
            stockReserved: Math.max(0, (inv.stockReserved || 0) - item.quantity)
          });
        }
      }

      console.log(`[Inventory] Released stock reservation ${reservationId} (Reason: ${reason})`);
      return inventoryRepository.updateReservation(reservationId, {
        status: reason === 'EXPIRED' ? 'EXPIRED' : 'RELEASED',
        releasedAt: new Date().toISOString(),
        releaseReason: reason
      });
    });
  }

  async getReservationStatus(reservationId) {
    const res = inventoryRepository.findReservationById(reservationId);
    if (!res) throw new Error(`Reservation ${reservationId} not found`);
    const isExpired = res.status === 'ACTIVE' && new Date(res.expiresAt) < new Date();
    return {
      ...res,
      isExpired
    };
  }

  // Active sweeper that checks for expired 5-minute locks
  sweepExpiredReservations() {
    const active = inventoryRepository.findActiveReservations();
    const now = new Date();
    let count = 0;
    for (const res of active) {
      if (new Date(res.expiresAt) <= now) {
        this.releaseReservation(res.id, 'EXPIRED');
        count++;
      }
    }
    return count;
  }

  startExpirySweeper(intervalMs = 15000) {
    if (this._sweeperInterval) clearInterval(this._sweeperInterval);
    this._sweeperInterval = setInterval(() => {
      try {
        const swept = this.sweepExpiredReservations();
        if (swept > 0) {
          console.log(`[Inventory Sweeper] Auto-released ${swept} expired stock reservation(s)`);
        }
      } catch (err) {
        console.error('[Inventory Sweeper] Error during sweep:', err.message);
      }
    }, intervalMs);
    // Unref so process can exit cleanly during tests
    if (this._sweeperInterval.unref) this._sweeperInterval.unref();
  }

  stopExpirySweeper() {
    if (this._sweeperInterval) {
      clearInterval(this._sweeperInterval);
      this._sweeperInterval = null;
    }
  }
}

module.exports = new InventoryService();
