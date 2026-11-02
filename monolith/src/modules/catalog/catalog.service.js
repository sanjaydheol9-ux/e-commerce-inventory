const catalogRepository = require('./catalog.repository');

class CatalogService {
  async getAllProducts(query) {
    return catalogRepository.findAll(query);
  }

  async getProductById(id) {
    const product = catalogRepository.findById(id);
    if (!product) {
      throw new Error(`Product not found with id: ${id}`);
    }
    return product;
  }

  async createProduct(data) {
    if (!data.name || data.price === undefined) {
      throw new Error('Product name and price are required');
    }
    if (isNaN(Number(data.price)) || Number(data.price) < 0) {
      throw new Error('Product price must be a non-negative number');
    }
    return catalogRepository.create(data);
  }

  async updateProduct(id, data) {
    await this.getProductById(id);
    return catalogRepository.update(id, data);
  }

  async deleteProduct(id) {
    await this.getProductById(id);
    return catalogRepository.delete(id);
  }
}

module.exports = new CatalogService();
