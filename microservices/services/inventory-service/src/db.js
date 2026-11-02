const fs = require('fs');
const path = require('path');

class InventoryDB {
  constructor(filePath) {
    this.filePath = filePath || path.join(__dirname, '../data/inventory_db.json');
    this.inventory = [];
    this.reservations = [];
    this.init();
  }

  init() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.inventory = parsed.inventory || [];
        this.reservations = parsed.reservations || [];
      } catch (e) {
        this.seed();
      }
    } else {
      this.seed();
    }
  }

  seed() {
    this.inventory = [
      { id: 'inv-001', productId: 'prod-001', stockAvailable: 50, stockReserved: 0, lowStockThreshold: 10 },
      { id: 'inv-002', productId: 'prod-002', stockAvailable: 35, stockReserved: 0, lowStockThreshold: 5 },
      { id: 'inv-003', productId: 'prod-003', stockAvailable: 15, stockReserved: 0, lowStockThreshold: 3 },
      { id: 'inv-004', productId: 'prod-004', stockAvailable: 8,  stockReserved: 0, lowStockThreshold: 2 },
      { id: 'inv-005', productId: 'prod-005', stockAvailable: 100, stockReserved: 0, lowStockThreshold: 15 }
    ];
    this.reservations = [];
    this.save();
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify({
        inventory: this.inventory,
        reservations: this.reservations
      }, null, 2), 'utf8');
    } catch (err) {
      console.error('[InventoryDB] Save error:', err.message);
    }
  }

  getAll() {
    return this.inventory.map(item => ({
      ...item,
      isLowStock: item.stockAvailable <= item.lowStockThreshold
    }));
  }

  findByProductId(productId) {
    return this.inventory.find(i => i.productId === productId) || null;
  }

  updateStock(productId, stockAvailable, lowStockThreshold = 5) {
    const existing = this.findByProductId(productId);
    if (existing) {
      existing.stockAvailable = stockAvailable;
      existing.lowStockThreshold = lowStockThreshold;
      this.save();
      return existing;
    }
    const item = {
      id: `inv-${Date.now()}`,
      productId,
      stockAvailable,
      stockReserved: 0,
      lowStockThreshold
    };
    this.inventory.push(item);
    this.save();
    return item;
  }

  saveReservation(res) {
    this.reservations.push(res);
    this.save();
    return res;
  }

  findReservationById(id) {
    return this.reservations.find(r => r.id === id) || null;
  }

  updateReservation(id, updates) {
    const r = this.findReservationById(id);
    if (!r) return null;
    Object.assign(r, updates);
    this.save();
    return r;
  }

  getActiveReservations() {
    return this.reservations.filter(r => r.status === 'ACTIVE');
  }
}

module.exports = new InventoryDB();
