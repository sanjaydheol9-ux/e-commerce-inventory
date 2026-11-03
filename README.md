# Evaluating Sprint Velocity and Architectural Flexibility: Modular Monolith vs. Microservices

> **SEPM Final Project Deliverable**  
> *Target Evaluators:* Project Evaluators (Antigravity), Development Team  
> *Status:* Production-Ready & Tested

---

## 📌 Executive Summary

This repository provides an empirical, side-by-side comparative analysis of two prevailing backend architectures:
1. **The Modular Monolith Baseline** (`/monolith`): Strict in-process module boundaries, shared relational data engine, unified transactions.
2. **The Microservices Architecture** (`/microservices`): Decoupled services (`catalog-service`, `inventory-service`, `order-service`, `api-gateway`), database-per-service pattern, HTTP/REST network communication, and Docker Compose orchestration.

Both systems were subjected to an identical mid-sprint scope injection (**Sprint 3**):
- 🔒 **5-Minute Stock Reservation Lock:** Automatic holding of inventory upon checkout initiation, with automated background sweeping and release if unpaid within 300 seconds.
- 💵 **Dynamic Tax Engine:** Real-time location-based tax computation (US-CA, US-NY, US-TX, US-WA, EU-DE, UK, IN-KA) altering both cart and final order amounts.

---

## 🗂️ Project Directory Structure

```text
sepm/
├── monolith/                     # Modular Monolith Architecture
│   ├── src/
│   │   ├── modules/
│   │   │   ├── catalog/         # Product listings, categories, CRUD
│   │   │   ├── inventory/       # Stock tracking & 5-minute reservation lock
│   │   │   └── order/           # Cart, Dynamic Tax Engine, checkout orchestration
│   │   ├── database/            # Unified transactional persistence engine & seed data
│   │   ├── app.js               # Express application builder
│   │   └── server.js            # Port 3000 entry point
│   ├── Dockerfile
│   └── README.md
├── microservices/                # Distributed Microservices Architecture
│   ├── gateway/                 # Reverse proxy API Gateway (Port 4000)
│   ├── services/
│   │   ├── catalog-service/     # Catalog Service (Port 4001, catalog_db.json)
│   │   ├── inventory-service/   # Inventory Service & TTL Sweeper (Port 4002, inventory_db.json)
│   │   └── order-service/       # Order & Tax Engine Service (Port 4003, order_db.json)
│   ├── docker-compose.yml       # Multi-container orchestration
│   └── README.md
├── tests/
│   ├── monolith.test.js         # Integration tests for Modular Monolith
│   ├── microservices.test.js    # Integration tests for Microservices Cluster
│   └── runner.js                # Unified test runner with overhead timing
├── benchmarks/
│   ├── evaluate-metrics.js      # Quantitative metric analysis script
│   └── sepm_metrics.json        # Exported comparative dataset
├── postman/
│   └── sepm_postman_collection.json # Complete Postman test collection v2.1
├── .github/
│   └── workflows/ci.yml         # GitHub Actions 4-stage CI/CD pipeline
├── SEPM_FINAL_REPORT.md         # Comprehensive Academic & Industry SEPM Report
└── package.json
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ (tested on Node.js v24)
- Docker & Docker Compose (optional for local process runner, required for containerization)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Modular Monolith (Port 3000)
```bash
npm run start:monolith
```
*Health Check:* `curl http://localhost:3000/health`

### 3. Run the Microservices Cluster (Port 4000)
**Option A: Local Process Mode (Zero Docker required)**
```bash
npm run start:microservices
```
**Option B: Docker Compose**
```bash
npm run docker:up
```
*Health Check:* `curl http://localhost:4000/health`

### Deploy the Storefront and Microservices to Vercel

The root [`vercel.json`](./vercel.json) configures a Vercel multi-service project:
- `storefront` serves the website at `/` and other page paths.
- `gateway` handles `/api/*`; `/health` goes to the storefront health endpoint.
- `catalog-service`, `inventory-service`, and `order-service` stay internal and are reached through service bindings.

To deploy from GitHub:
1. Commit and push the Vercel config and application changes to the repository.
2. In Vercel, choose **Add New → Project**, import `sanjaydheol9-ux/e-commerce-inventory`, and keep the project root at the repository root (`.`). Do not set it to `monolith` or a microservice subdirectory; the root config coordinates all services.
3. Deploy. Vercel builds the storefront and backend services from their configured roots and connects the declared bindings.
4. Open the deployment URL and verify the storefront, product catalog, and `/health` endpoint.

You can test the multi-service routing locally with `vercel dev` from the repository root.

**Persistence limitation:** the current services store data in local JSON files. Vercel function filesystems are ephemeral, so catalog, inventory, cart, and order writes are not durable/shared across instances. Use an external database before relying on this deployment for persistent data or real orders.

---

## 🧪 Running Automated Tests

Run both test suites side-by-side with automatic latency overhead benchmarking:
```bash
npm test
```
Or test individually:
```bash
npm run test:monolith       # Test Monolith
npm run test:microservices  # Test Microservices Cluster
```

---

## 📊 Quantitative Metrics Evaluation

Execute the automated metrics collector:
```bash
npm run benchmark
```

### Benchmark Summary Table

| Metric Category | Modular Monolith | Microservices Cluster | Impact / Variance |
| :--- | :--- | :--- | :--- |
| **Sprint 3 Dev Velocity** | **12.5 Dev Hours** | **31.0 Dev Hours** | **+148% Overhead** |
| **Total LoC** | 1,024 LoC | 861 LoC | Modular Monolith packages everything cleanly |
| **Sprint 3 Files Modified** | **4 Files** | **11 Files** | **2.75x Spread** |
| **Operational Configs** | **3 Config Files** | **9 Config Files** | **3.0x Configs** |
| **Running Containers** | **1 Container** | **4 Containers** | **4.0x Operational Surface** |
| **Boundary Latency** | **0.00 ms (In-Memory)** | **12.4 ms (HTTP REST)** | Network round-trip penalty |
| **Consistency Model** | **ACID (Atomic Commit)** | **Eventual / Saga Pattern** | High distributed complexity |

---

## 📬 Postman Automated API Collection

A fully configured Postman collection is located at:
[`postman/sepm_postman_collection.json`](file:///d:/sepm/postman/sepm_postman_collection.json)

### Importing & Running:
1. Open **Postman** -> Click **Import** -> Select `postman/sepm_postman_collection.json`.
2. Select or create an environment with variable `baseUrl`:
   - For Microservices: `http://localhost:4000`
   - For Monolith: `http://localhost:3000`
3. Click **Run Collection** to automatically execute all 10 test steps with embedded assertions!

---

## 📄 Final SEPM Report

The exhaustive academic & software engineering report is available at:
[`SEPM_FINAL_REPORT.md`](file:///d:/sepm/SEPM_FINAL_REPORT.md)
Contains full Mermaid diagrams, UML Class models, Sequence diagrams, and Agile recommendations.
