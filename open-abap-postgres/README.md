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

The UI runs at <http://127.0.0.1:3000/>. It covers full customer details, products with status, draft/validated/delivered/cancelled multi-line orders, invoice generation and guarded cancellation, partial/final payments with reconciliation/cancellation, a commercial summary, sales/balance reports, and an audit history. Mutations run through the transpiled `ZCL_CUSTOMER_SERVICE`; reads and projections use PostgreSQL through the Node API.

Reporting includes inclusive date filters for sales by order date and receipts by payment date, daily payment counts/totals, and CSV export of the displayed report data. Open invoice balances always show current balances across all periods, not historical balances at the selected end date. Cancelled payments are excluded from receipts and invoice paid totals. The REST report accepts optional `from` and `to` parameters in `YYYY-MM-DD` format and rejects invalid or reversed date ranges with HTTP 400.

The PostgreSQL model includes customer codes/types/contact details, products, sales orders, order lines, invoices, payments, and an audit log. ABAP Dictionary XML files in `src/` drive the generated table schema. The server adds missing customer columns without dropping existing rows, creates missing tables incrementally, and seeds customers/products only when those tables are empty.

`npm run demo` is a smaller Open SQL count example. `npm run test:service` verifies customer/product CRUD, multi-line order editing/removal, validation/cancellation, invoice generation/cancellation guards, payment registration/reconciliation/cancellation, and audit persistence through ABAP and PostgreSQL.

This uses OpenABAP's supported ABAP subset and PostgreSQL driver. It is a local RAP-like execution experiment, not the SAP RAP runtime or CDS behavior implementation. Oracle and ORDS remain unchanged, and no Oracle data is migrated.