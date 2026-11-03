const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(`🚀 [SEPM] Modular Monolith Server Running`);
  console.log(`📡 URL: http://localhost:${config.port}`);
  console.log(`📦 Architecture: Modular Monolith (Sprint 1 -> 3)`);
  console.log(`🔒 Features Active: 5-Min Reservation Lock + Dynamic Tax`);
  console.log(`====================================================`);
});

module.exports = { app, server };
