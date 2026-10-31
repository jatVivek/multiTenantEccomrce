# Multi-Tenant Clothing E-Commerce Platform

A lightweight, high-performance, multi-tenant e-commerce system built for apparel brands in India. Features instant UPI deep-linking, WhatsApp customer alerts, inventory oversell protection, and an administrative fulfillment hub.

---

## 🛠️ Tech Stack

* **Runtime & API**: [Node.js](https://nodejs.org/) (>= 20) with [Hono](https://hono.dev/)
* **Database & ORM**: PostgreSQL 16 with [Drizzle ORM](https://orm.drizzle.team/)
* **Authentication**: JWT & `bcrypt` (10 rounds) RBAC (`SUPER_ADMIN`, `BRAND_ADMIN`)
* **Validation**: [Zod](https://zod.dev/)
* **Testing**: [Vitest](https://vitest.dev/)
* **Deployment**: Docker, `docker-compose`, and Linux `systemd`

---

## 🚀 Quick Start

### 1. Environment Configuration
Ensure your `.env` contains:
```env
DATABASE_URL=postgresql://dev_user:dev_pass@localhost:5432/clothing_setup
JWT_SECRET=dev_jwt_secret_clothing_setup_multitenant_key_2026
PORT=3000
```

### 2. Install Dependencies & Start Server
```bash
npm install
npm run dev
```

The server will boot on `http://localhost:3000`.

---

## 🌐 URLs & Access

* **Customer Storefront**: [`http://localhost:3000/store/demo-brand`](http://localhost:3000/store/demo-brand)
* **Admin Portal**: [`http://localhost:3000/admin`](http://localhost:3000/admin)
* **Health Check**: [`http://localhost:3000/`](http://localhost:3000/)

### Default Admin Credentials
* **Email**: `admin@clothing.local`
* **Password**: `AdminPassword123!`
* **Role**: `SUPER_ADMIN`

---

## 🧪 Testing

Run all 18 automated integration tests:
```bash
npm test
```

---

## 📦 Docker Deployment

To launch the application and database together via Docker Compose:
```bash
docker compose up --build -d
```
