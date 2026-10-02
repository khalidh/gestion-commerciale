# OpenABAP with PostgreSQL

This local desktop-web prototype runs ABAP business methods through the abaplint transpiler/runtime, executes Open SQL against PostgreSQL 18, exposes the commercial workflows through a Node REST API, and serves a SAPUI5 application.

## Prerequisites

- Node.js 22 or later
- PostgreSQL 18 running on `127.0.0.1:5432`

## Setup

```powershell
npm install
npm run setup
npm run test:service
npm start
```

The setup command asks for the local PostgreSQL `postgres` password without echoing it. It creates a dedicated `openabap_app` role and `openabap_demo` database, generates an application password, and writes connection settings to `.env`. That file is ignored by Git.

The UI runs at <http://127.0.0.1:3000/>. It covers customers and products, draft and validated orders with a line item, invoice generation, partial/final payments, and a summary. Mutations run through the transpiled `ZCL_CUSTOMER_SERVICE`; reads and projections use PostgreSQL through the Node API.

The PostgreSQL model includes customers, products, sales orders, order lines, invoices, and payments. ABAP Dictionary XML files in `src/` drive the generated table schema. The server creates missing tables incrementally and seeds customers/products only when those tables are empty.

`npm run demo` is a smaller Open SQL count example. `npm run test:service` verifies customer/product CRUD and the full order-validation-invoice-payment lifecycle through ABAP and PostgreSQL.

This uses OpenABAP's supported ABAP subset and PostgreSQL driver. It is a local RAP-like execution experiment, not the SAP RAP runtime or CDS behavior implementation. Oracle and ORDS remain unchanged, and no Oracle data is migrated.