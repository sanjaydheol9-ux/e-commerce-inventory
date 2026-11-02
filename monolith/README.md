# Modular Monolith Architecture

## Architecture Overview
The Modular Monolith packages the e-commerce system into a single runtime unit while enforcing strict boundaries between modules:
- `src/modules/catalog/`: Product catalog management, categories, price structures.
- `src/modules/inventory/`: Stock tracking, low-stock threshold alerts, and the **5-minute Stock Reservation Lock** (Sprint 3).
- `src/modules/order/`: Cart state, **Dynamic Tax Engine** (Sprint 3), checkout coordination, and payment finalization.

## Internal Boundaries
- Services do NOT query other module tables directly.
- The `OrderService` delegates stock queries and reservations exclusively through public methods on `InventoryService`.
- Module dependencies are in-process method invocations, offering near-zero latency, atomic ACID transaction wrapping, and straightforward debugging.

## Starting the Monolith
```bash
npm run start:monolith
```
The server will start on `http://localhost:3000`.

## Endpoints
- **Health:** `GET /health`
- **Catalog:**
  - `GET /api/catalog`
  - `GET /api/catalog/:id`
  - `POST /api/catalog`
- **Inventory:**
  - `GET /api/inventory`
  - `GET /api/inventory/:productId`
  - `POST /api/inventory/reservations`
  - `GET /api/inventory/reservations/:id`
- **Orders & Cart:**
  - `GET /api/cart/:cartId`
  - `POST /api/cart/:cartId/items`
  - `POST /api/cart/:cartId/checkout`
  - `POST /api/orders/:id/pay`
  - `GET /api/tax/quote?subtotal=100&locationCode=US-CA`
