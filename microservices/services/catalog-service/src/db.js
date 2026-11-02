const fs = require('fs');
const path = require('path');

class CatalogDB {
  constructor(filePath) {
    this.filePath = filePath || path.join(__dirname, '../data/catalog_db.json');
    this.products = [];
    this.init();
  }

  init() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.products = JSON.parse(raw);
      } catch (e) {
        this.seed();
      }
    } else {
      this.seed();
    }
  }

  seed() {
    this.products = [
      { id: 'prod-001', name: 'Wireless Mechanical Keyboard', category: 'Electronics', price: 129.99, description: 'Compact 75% Bluetooth/2.4G RGB mechanical keyboard with hot-swappable switches' },
      { id: 'prod-002', name: 'Ergonomic Gaming Mouse', category: 'Electronics', price: 69.99, description: 'High-precision 26,000 DPI sensor with ultra-lightweight chassis' },
      { id: 'prod-003', name: 'Noise-Cancelling Studio Headphones', category: 'Audio', price: 249.99, description: 'Active noise cancelling wireless over-ear audiophile headphones' },
      { id: 'prod-004', name: '4K UltraWide Monitor 34"', category: 'Electronics', price: 599.99, description: 'Curved 144Hz IPS display with 99% sRGB color gamut' },
      { id: 'prod-005', name: 'Solid Walnut Desk Mat', category: 'Accessories', price: 39.99, description: 'Natural organic felt and vegan leather desk pad' }
    ];
    this.save();
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.products, null, 2), 'utf8');
    } catch (err) {
      console.error('[CatalogDB] Save error:', err.message);
    }
  }

  findAll(query = {}) {
    return this.products.filter(item => {
      let match = true;
      if (query.category) match = match && item.category.toLowerCase() === query.category.toLowerCase();
      if (query.search) {
        const s = query.search.toLowerCase();
        match = match && (item.name.toLowerCase().includes(s) || item.description.toLowerCase().includes(s));
      }
      return match;
    });
  }

  findById(id) {
    return this.products.find(p => p.id === id) || null;
  }

  insert(data) {
    const item = { ...data, createdAt: new Date().toISOString() };
    this.products.push(item);
    this.save();
    return item;
  }

  update(id, data) {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    this.products[idx] = { ...this.products[idx], ...data, updatedAt: new Date().toISOString() };
    this.save();
    return this.products[idx];
  }

  delete(id) {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.products.splice(idx, 1);
    this.save();
    return true;
  }
}

module.exports = new CatalogDB();
