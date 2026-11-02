const { fork } = require('child_process');
const path = require('path');

console.log('🚀 Starting SEPM Microservices Cluster locally...');

const services = [
  { name: 'Catalog Service', script: path.join(__dirname, '../microservices/services/catalog-service/src/server.js'), port: 4001 },
  { name: 'Inventory Service', script: path.join(__dirname, '../microservices/services/inventory-service/src/server.js'), port: 4002 },
  { name: 'Order Service', script: path.join(__dirname, '../microservices/services/order-service/src/server.js'), port: 4003 },
  { name: 'API Gateway', script: path.join(__dirname, '../microservices/gateway/src/gateway.js'), port: 4000 }
];

const children = [];

services.forEach(s => {
  const child = fork(s.script, [], {
    env: {
      ...process.env,
      PORT: s.port,
      CATALOG_SERVICE_URL: 'http://localhost:4001',
      INVENTORY_SERVICE_URL: 'http://localhost:4002',
      ORDER_SERVICE_URL: 'http://localhost:4003'
    }
  });

  child.on('error', err => {
    console.error(`[${s.name}] Process error:`, err);
  });

  children.push(child);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down all microservices...');
  children.forEach(c => c.kill());
  process.exit(0);
});

process.on('SIGTERM', () => {
  children.forEach(c => c.kill());
  process.exit(0);
});
