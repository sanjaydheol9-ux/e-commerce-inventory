const { monolithDb } = require('../../database/db');
const { v4: uuidv4 } = require('uuid');

class CatalogRepository {
  constructor(db = monolithDb) {
    this.db = db;
  }

  findAll(query = {}) {
    return this.db.find('products', item => {
      let match = true;
      if (query.category) {
        match = match && item.category.toLowerCase() === query.category.toLowerCase();
      }
      if (query.search) {
        const s = query.search.toLowerCase();
        match = match && (item.name.toLowerCase().includes(s) || item.description.toLowerCase().includes(s));
      }
      return match;
    });
  }

  findById(id) {
    return this.db.findById('products', id);
  }

  create(data) {
    const product = {
      id: data.id || `prod-${uuidv4().substring(0, 8)}`,
      name: data.name,
      category: data.category || 'General',
      price: Number(data.price),
      description: data.description || ''
    };
    return this.db.insert('products', product);
  }

  update(id, data) {
    return this.db.update('products', id, data);
  }

  delete(id) {
    return this.db.delete('products', id);
  }
}

module.exports = new CatalogRepository();
