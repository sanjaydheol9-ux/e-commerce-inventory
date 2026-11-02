const fs = require('fs');
const path = require('path');

class RelationalDatabase {
  constructor(dbFilePath) {
    this.dbFilePath = dbFilePath || path.join(__dirname, '../../data/monolith_db.json');
    this.tables = {
      products: [],
      inventory: [],
      reservations: [],
      orders: [],
      order_items: [],
      carts: []
    };
    this.init();
  }

  init() {
    const dir = path.dirname(this.dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(this.dbFilePath)) {
      try {
        const raw = fs.readFileSync(this.dbFilePath, 'utf8');
        this.tables = Object.assign(this.tables, JSON.parse(raw));
      } catch (err) {
        console.warn('[Database] Initializing fresh database due to parse error:', err.message);
      }
    } else {
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(this.dbFilePath, JSON.stringify(this.tables, null, 2), 'utf8');
    } catch (err) {
      console.error('[Database] Failed to write db file:', err.message);
    }
  }

  getTable(name) {
    if (!this.tables[name]) {
      this.tables[name] = [];
    }
    return this.tables[name];
  }

  find(tableName, filterFn = () => true) {
    const rows = this.getTable(tableName);
    return rows.filter(filterFn).map(r => ({ ...r }));
  }

  findOne(tableName, filterFn) {
    const rows = this.getTable(tableName);
    const item = rows.find(filterFn);
    return item ? { ...item } : null;
  }

  findById(tableName, id) {
    return this.findOne(tableName, r => r.id === id);
  }

  insert(tableName, record) {
    const table = this.getTable(tableName);
    const newRecord = {
      ...record,
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || new Date().toISOString()
    };
    table.push(newRecord);
    this.save();
    return { ...newRecord };
  }

  update(tableName, id, updates) {
    const table = this.getTable(tableName);
    const index = table.findIndex(r => r.id === id);
    if (index === -1) return null;
    table[index] = {
      ...table[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return { ...table[index] };
  }

  delete(tableName, id) {
    const table = this.getTable(tableName);
    const index = table.findIndex(r => r.id === id);
    if (index === -1) return false;
    table.splice(index, 1);
    this.save();
    return true;
  }

  // ACID-like transaction wrapper for Monolithic consistency
  transaction(callback) {
    const snapshot = JSON.stringify(this.tables);
    try {
      const result = callback(this);
      this.save();
      return result;
    } catch (err) {
      this.tables = JSON.parse(snapshot);
      throw err;
    }
  }

  clearAll() {
    for (const key of Object.keys(this.tables)) {
      this.tables[key] = [];
    }
    this.save();
  }
}

// Singleton database instance
const monolithDb = new RelationalDatabase();

module.exports = { RelationalDatabase, monolithDb };
