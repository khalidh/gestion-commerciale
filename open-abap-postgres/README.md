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
npm run test:security
npm run user -- admin APP_ADMIN
npm start
```

The setup command asks for the local PostgreSQL `postgres` password without echoing it. It creates a dedicated `openabap_app` role and `openabap_demo` database, generates an application password, and writes connection settings to `.env`. That file is ignored by Git.

## Accounts And Roles

All commercial API routes require a signed-in account. There is no default account or password. `npm run user -- admin APP_ADMIN` asks twice for a password directly in the terminal without echoing it (12 characters minimum). Only a salted scrypt hash is stored in PostgreSQL. Use the same command to reset a password or change a role; existing sessions are revoked. `npm run user -- username --disable` disables an account and revokes its sessions. These commands require local database access and are not exposed through HTTP.

On Windows, run `./scripts/admin-password-window.ps1` from PowerShell for a local dialog with two masked password fields. It creates or resets the `admin` account with `APP_ADMIN` permissions. The password is passed to the existing account command through a local UTF-8 stdin pipe, not through command-line arguments, files or chat. Cancelling the dialog does not change the account.

- `APP_ADMIN`: all commercial operations.
- `SALES_USER`: customer/product management and order creation, editing, validation, delivery and cancellation.
- `FINANCE_USER`: invoice generation/cancellation and payment registration, reconciliation and cancellation.
- `REPORT_USER`: read-only access.

All four roles can read commercial data, reports and audit history. SAPUI5 disables mutation buttons according to the role; the API independently enforces permissions. Audit entries identify the signed-in username. Sessions use opaque HttpOnly, SameSite=Strict cookies, expire after eight hours, and are revoked on logout. API mutations require `X-GC-Request: 1` and reject a mismatching Origin. Login attempts are limited per IP in the local server process. No session tokens are stored in browser localStorage.

The server still binds only to loopback. HTTPS is required before exposing it beyond this local prototype; on HTTPS session cookies are marked Secure. This is not an enterprise identity provider or a replacement for SAP BTP authentication.

The UI runs at <http://127.0.0.1:3000/>. It covers full customer details, products with status, draft/validated/delivered/cancelled multi-line orders, invoice generation and guarded cancellation, partial/final payments with reconciliation/cancellation, a commercial summary, sales/balance reports, and an audit history. Mutations run through the transpiled `ZCL_CUSTOMER_SERVICE`; reads and projections use PostgreSQL through the Node API.

Reporting includes inclusive date filters for sales by order date and receipts by payment date, daily payment counts/totals, and CSV export of the displayed report data. Open invoice balances always show current balances across all periods, not historical balances at the selected end date. Cancelled payments are excluded from receipts and invoice paid totals. The REST report accepts optional `from` and `to` parameters in `YYYY-MM-DD` format and rejects invalid or reversed date ranges with HTTP 400.

The PostgreSQL model includes customer codes/types/contact details, products, sales orders, order lines, invoices, payments, and an audit log. ABAP Dictionary XML files in `src/` drive the generated table schema. The server adds missing customer columns without dropping existing rows, creates missing tables incrementally, and seeds customers/products only when those tables are empty.

`npm run demo` is a smaller Open SQL count example. `npm run test:service` verifies customer/product CRUD, multi-line order editing/removal, validation/cancellation, invoice generation/cancellation guards, payment registration/reconciliation/cancellation, and audit persistence through ABAP and PostgreSQL.

`npm run test:security` exercises the session and role middleware through HTTP using a temporary PostgreSQL schema, removed after the run. It does not create accounts in the application schema or modify commercial rows.

With the application server running, `npm run test:security -- --server` additionally checks authenticated commercial reads, an audited customer mutation, role changes and session revocation against the real server. Its temporary application account, customer and audit entries are removed after the test. Browser checks cover the unauthenticated form and invalid credentials; successful interactive login should also be checked with the locally created account.

This uses OpenABAP's supported ABAP subset and PostgreSQL driver. It is a local RAP-like execution experiment, not the SAP RAP runtime or CDS behavior implementation. Oracle and ORDS remain unchanged, and no Oracle data is migrated.