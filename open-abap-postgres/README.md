# OpenABAP with PostgreSQL

This local prototype runs ABAP business methods through the abaplint transpiler/runtime, executes Open SQL against PostgreSQL 18, exposes client CRUD through a Node REST API, and serves a SAPUI5 client screen.

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

The UI runs at <http://127.0.0.1:3000/>. Its `/api/customers` endpoints read PostgreSQL and invoke the transpiled `ZCL_CUSTOMER_SERVICE` for create, update, delete, and name normalization. The table is generated from `src/zgc_customer.tabl.xml`; the server seeds two local sample customers when the table is empty.

`npm run demo` is a smaller Open SQL count example. `npm run test:service` verifies create/update/delete through ABAP and PostgreSQL.

This uses OpenABAP's supported ABAP subset and PostgreSQL driver. It is a local RAP-like execution experiment, not the SAP RAP runtime or CDS behavior implementation. Oracle and ORDS remain unchanged, and no Oracle data is migrated.