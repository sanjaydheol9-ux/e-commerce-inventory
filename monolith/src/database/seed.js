const { monolithDb } = require('./db');

function seedDatabase(db = monolithDb) {
  // If products already exist, skip re-seeding
  const existing = db.find('products');
  if (existing.length > 0) {
    return;
  }

  const initialProducts = [
    {
      id: 'prod-001',
      name: 'Wireless Mechanical Keyboard',
      category: 'Electronics',
      price: 129.99,
      description: 'Compact 75% Bluetooth/2.4G RGB mechanical keyboard with hot-swappable switches'
    },
    {
      id: 'prod-002',
      name: 'Ergonomic Gaming Mouse',
      category: 'Electronics',
      price: 69.99,
      description: 'High-precision 26,000 DPI sensor with ultra-lightweight chassis'
    },
    {
      id: 'prod-003',
      name: 'Noise-Cancelling Studio Headphones',
      category: 'Audio',
      price: 249.99,
      description: 'Active noise cancelling wireless over-ear audiophile headphones'
    },
    {
      id: 'prod-004',
      name: '4K UltraWide Monitor 34"',
      category: 'Electronics',
      price: 599.99,
      description: 'Curved 144Hz IPS display with 99% sRGB color gamut'
    },
    {
      id: 'prod-005',
      name: 'Solid Walnut Desk Mat',
      category: 'Accessories',
      price: 39.99,
      description: 'Natural organic felt and vegan leather desk pad'
    }
  ];

  const initialInventory = [
    { id: 'inv-001', productId: 'prod-001', stockAvailable: 50, stockReserved: 0, lowStockThreshold: 10 },
    { id: 'inv-002', productId: 'prod-002', stockAvailable: 35, stockReserved: 0, lowStockThreshold: 5 },
    { id: 'inv-003', productId: 'prod-003', stockAvailable: 15, stockReserved: 0, lowStockThreshold: 3 },
    { id: 'inv-004', productId: 'prod-004', stockAvailable: 8,  stockReserved: 0, lowStockThreshold: 2 },
    { id: 'inv-005', productId: 'prod-005', stockAvailable: 100, stockReserved: 0, lowStockThreshold: 15 }
  ];

  initialProducts.forEach(p => db.insert('products', p));
  initialInventory.forEach(inv => db.insert('inventory', inv));

  console.log('[Database] Seeded 5 products and 5 inventory records successfully.');
}

module.exports = { seedDatabase };
