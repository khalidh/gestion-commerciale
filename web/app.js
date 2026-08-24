const STORAGE_KEY = 'commercial-app-state-v4';
const API_KEY_STORAGE_KEY = 'commercial-app-api-key';
const ORDS_API_BASE_URL = `${window.location.origin}/ords/gestion-commerciale/gestion-commerciale/api`;
const API_BASE_URL = ORDS_API_BASE_URL;

let state = { customers: [], products: [], orders: [], invoices: [], payments: [], auditLog: [] };
let dataSource = 'local';
let dataSourceError = '';
let authSession = null;

const defaultState = {
  customers: [
    { id: 1, name: 'Acme SA', contact: 'Jean Martin', status: 'Actif' },
    { id: 2, name: 'Globex', contact: 'Sophie Dubois', status: 'Actif' },
    { id: 3, name: 'Initech', contact: 'Paul Durand', status: 'Inactif' }
  ],
  products: [
    { id: 1, name: 'Pack Premium', price: 1250, status: 'Actif' },
    { id: 2, name: 'Abonnement Pro', price: 320, status: 'Actif' },
    { id: 3, name: 'Formation Enterprise', price: 950, status: 'Actif' }
  ],
  orders: [
    { id: 1, customerId: 1, productId: 1, quantity: 2, amount: 2500, status: 'Validée' },
    { id: 2, customerId: 2, productId: 2, quantity: 5, amount: 1600, status: 'Brouillon' }
  ],
  invoices: [
    { id: 1, orderId: 1, number: 'INV-001', amount: 2500, status: 'Payée' }
  ],
  payments: [
    { id: 1, invoiceId: 1, amount: 2500, method: 'Virement', date: '2026-08-23' }
  ],
  auditLog: [
    { id: 1, module: 'INVOICE', action: 'GENERATE', detail: 'Facture initiale INV-001', date: '2026-08-23' },
    { id: 2, module: 'PAYMENT', action: 'REGISTER', detail: 'Paiement initial INV-001', date: '2026-08-23' }
  ]
};

function safeSelect(id) {
  return document.getElementById(id);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getApiKey() {
  return sessionStorage.getItem(API_KEY_STORAGE_KEY) || '';
}

function saveApiKey(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return false;
  }
  sessionStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
  return true;
}

function clearApiKey() {
  sessionStorage.removeItem(API_KEY_STORAGE_KEY);
  authSession = null;
}

function authHeaders(extraHeaders = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ...extraHeaders };
  }
  return {
    ...extraHeaders,
    'X-API-Key': apiKey
  };
}

function buildApiUrl(baseUrl, path) {
  const url = new URL(`${baseUrl}${path}`, window.location.origin);
  const apiKey = getApiKey();
  if (apiKey) {
    url.searchParams.set('X_API_KEY', apiKey);
  }
  return url.toString();
}

function normalizeData(data) {
  return {
    customers: data.customers.map((customer) => ({
      ...customer,
      status: customer.status === 'ACTIVE' ? 'Actif' : customer.status === 'INACTIVE' ? 'Inactif' : customer.status
    })),
    products: data.products.map((product) => ({
      ...product,
      status: product.status === 'ACTIVE' ? 'Actif' : product.status === 'INACTIVE' ? 'Inactif' : product.status
    })),
    orders: data.orders.map((order) => ({
      ...order,
      status: order.status === 'VALIDATED' ? 'Validée' : order.status === 'DRAFT' ? 'Brouillon' : order.status
    })),
    invoices: data.invoices.map((invoice) => ({
      ...invoice,
      status: invoice.status === 'PAID' ? 'Payée' : invoice.status === 'OPEN' ? 'Ouverte' : invoice.status
    })),
    payments: data.payments.map((payment) => ({
      ...payment,
      method: payment.method || 'Virement',
      date: payment.date || new Date().toISOString().slice(0, 10)
    })),
    auditLog: (data.auditLog || defaultState.auditLog).map((entry) => ({ ...entry }))
  };
}

async function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    state = normalizeData(JSON.parse(saved));
  } else {
    state = clone(defaultState);
  }

  if (!getApiKey()) {
    dataSource = 'local';
    dataSourceError = 'API key manquante (mode local)';
    return;
  }

  try {
    authSession = await loadAuthSession();
    state = await loadOracleState();
    dataSource = 'oracle';
    dataSourceError = '';
    saveState();
    return;
  } catch (error) {
    dataSource = 'local';
    dataSourceError = error.message || String(error) || 'chargement Oracle indisponible';
    return;
  }
}

async function fetchJson(path) {
  const response = await fetch(buildApiUrl(API_BASE_URL, path), {
    headers: authHeaders()
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('authentification refusee');
  }
  if (!response.ok) {
    throw new Error(`API ${path} indisponible`);
  }
  const payload = await response.json();
  if (payload && payload.source === 'demo-fallback') {
    throw new Error(payload.oracle_error || 'API en fallback démo');
  }
  return payload.items || payload;
}

async function postOrds(path, payload) {
  const response = await fetch(buildApiUrl(ORDS_API_BASE_URL, path), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload || {})
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('authentification refusee');
  }
  if (!response.ok) {
    throw new Error(`ORDS ${path} a répondu ${response.status}`);
  }
}

async function loadAuthSession() {
  const response = await fetch(buildApiUrl(ORDS_API_BASE_URL, '/auth/session'), {
    headers: authHeaders()
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('api key invalide ou role non autorise');
  }
  if (!response.ok) {
    throw new Error('endpoint auth/session indisponible');
  }
  return response.json();
}

async function refreshOracleSnapshot() {
  try {
    state = await loadOracleState();
    dataSource = 'oracle';
    dataSourceError = '';
    saveState();
  } catch (error) {
    dataSource = 'local';
    dataSourceError = error.message || String(error) || 'chargement Oracle indisponible';
  }
  render();
}

async function loadOracleState() {
  const customers = await fetchJson('/customers');
  const products = await fetchJson('/products');
  const orders = await fetchJson('/orders');
  const invoices = await fetchJson('/invoices');
  const payments = await fetchJson('/payments');
  const audit = await fetchJson('/audit');

  return normalizeData({
    customers: customers.map((customer) => ({
      id: customer.customer_id,
      name: customer.customer_name,
      contact: customer.email || customer.phone || customer.customer_code,
      status: customer.status
    })),
    products: products.map((product) => ({
      id: product.product_id,
      name: product.product_name,
      price: product.unit_price,
      status: product.status
    })),
    orders: orders.map((order) => ({
      id: order.sales_order_id,
      customerId: customers.find((customer) => customer.customer_name === order.customer_name)?.customer_id,
      productId: products[0]?.product_id,
      quantity: 1,
      amount: order.total_amount,
      status: order.order_status
    })),
    invoices: invoices.map((invoice) => ({
      id: invoice.invoice_id,
      orderId: invoice.sales_order_id || orders.find((order) => order.customer_name === invoice.customer_name)?.sales_order_id,
      number: invoice.invoice_number,
      amount: invoice.total_amount,
      status: invoice.invoice_status
    })),
    payments: payments.map((payment) => ({
      id: payment.payment_id,
      invoiceId: payment.invoice_id,
      amount: payment.payment_amount,
      method: payment.payment_method,
      date: String(payment.payment_date).slice(0, 10)
    })),
    auditLog: audit.map((entry) => ({
      id: entry.audit_log_id,
      module: entry.module_name,
      action: entry.action_name,
      detail: entry.action_details,
      date: String(entry.created_at).slice(0, 10)
    }))
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  state = clone(defaultState);
  logAction('SYSTEM', 'RESET', 'Réinitialisation des données de démonstration', false);
  saveState();
  render();
}

function logAction(module, action, detail, persist = true) {
  state.auditLog.unshift({
    id: nextId(state.auditLog || []),
    module,
    action,
    detail,
    date: new Date().toISOString().slice(0, 10)
  });
  state.auditLog = state.auditLog.slice(0, 30);
  if (persist) saveState();
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount) || 0);
}

function getCustomerById(id) {
  return state.customers.find((customer) => Number(customer.id) === Number(id));
}

function getProductById(id) {
  return state.products.find((product) => Number(product.id) === Number(id));
}

function getOrderById(id) {
  return state.orders.find((order) => Number(order.id) === Number(id));
}

function getInvoiceById(id) {
  return state.invoices.find((invoice) => Number(invoice.id) === Number(id));
}

function getInvoicePaidAmount(invoiceId) {
  return state.payments
    .filter((payment) => Number(payment.invoiceId) === Number(invoiceId))
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);
}

function tagClass(status) {
  if (status === 'Payée') return 'paid';
  if (status === 'Ouverte') return 'open';
  if (status === 'Brouillon') return 'draft';
  return '';
}

function emptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

function render() {
  const source = safeSelect('dataSource');
  if (source) {
    const roleLabel = authSession?.role_code ? ` (${authSession.role_code})` : '';
    source.textContent = dataSource === 'oracle' ? `Oracle connecte${roleLabel}` : `Donnees locales (${dataSourceError})`;
  }
  renderDashboard();
  renderCustomers();
  renderProducts();
  renderOrders();
  renderInvoices();
  renderPayments();
  renderReports();
  renderSelects();
}

function renderDashboard() {
  const kpis = safeSelect('kpis');
  const activityList = safeSelect('activityList');
  const summaryText = safeSelect('summaryText');
  if (!kpis || !activityList || !summaryText) return;

  const totalRevenue = state.invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const totalPaid = state.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const openInvoices = state.invoices.filter((invoice) => invoice.status !== 'Payée').length;

  kpis.innerHTML = `
    <article class="card"><span class="kpi-value">${state.customers.length}</span><span class="kpi-label">Clients</span></article>
    <article class="card"><span class="kpi-value">${state.products.length}</span><span class="kpi-label">Produits</span></article>
    <article class="card"><span class="kpi-value">${state.orders.length}</span><span class="kpi-label">Commandes</span></article>
    <article class="card"><span class="kpi-value">${formatCurrency(totalRevenue)}</span><span class="kpi-label">CA facturé</span></article>
  `;

  const activities = [
    ...state.orders.slice(-3).map((order) => `Commande #${order.id} - ${getCustomerById(order.customerId)?.name || 'Client inconnu'} - ${formatCurrency(order.amount)}`),
    ...state.invoices.slice(-3).map((invoice) => `Facture ${invoice.number} - ${invoice.status} - ${formatCurrency(invoice.amount)}`),
    ...state.payments.slice(-2).map((payment) => `Paiement #${payment.id} - ${formatCurrency(payment.amount)} - ${payment.method}`)
  ].slice(-6).reverse();

  activityList.innerHTML = activities.length
    ? activities.map((item) => `<li>${item}</li>`).join('')
    : '<li>Aucune activité commerciale enregistrée.</li>';

  summaryText.textContent = `La base Phase 3 suit ${state.customers.length} clients, ${state.products.length} produits, ${state.orders.length} commandes, ${state.invoices.length} factures dont ${openInvoices} ouverte(s), et ${formatCurrency(totalPaid)} encaissés.`;
}

function renderCustomers() {
  const container = safeSelect('customersList');
  if (!container) return;
  container.innerHTML = state.customers.length ? state.customers.map((customer) => `
    <article class="item">
      <div class="item-main">
        <strong>${customer.name}</strong>
        <p>Contact : ${customer.contact || 'Non renseigné'}</p>
        <div class="item-meta"><span class="tag">${customer.status}</span></div>
      </div>
    </article>
  `).join('') : emptyState('Aucun client enregistré.');
}

function renderProducts() {
  const container = safeSelect('productsList');
  if (!container) return;
  container.innerHTML = state.products.length ? state.products.map((product) => `
    <article class="item">
      <div class="item-main">
        <strong>${product.name}</strong>
        <p>Prix HT : ${formatCurrency(product.price)}</p>
        <div class="item-meta"><span class="tag">${product.status}</span></div>
      </div>
    </article>
  `).join('') : emptyState('Aucun produit enregistré.');
}

function renderOrders() {
  const container = safeSelect('ordersList');
  if (!container) return;
  container.innerHTML = state.orders.length ? state.orders.map((order) => {
    const invoice = state.invoices.find((item) => Number(item.orderId) === Number(order.id));
    return `
      <article class="item">
        <div class="item-main">
          <strong>Commande #${order.id}</strong>
          <p>${getCustomerById(order.customerId)?.name || 'Client inconnu'} - ${getProductById(order.productId)?.name || 'Produit inconnu'}</p>
          <div class="item-meta">
            <span class="tag ${tagClass(order.status)}">${order.status}</span>
            <span class="tag">Qté ${order.quantity}</span>
            <span class="tag">${formatCurrency(order.amount)}</span>
            ${invoice ? `<span class="tag paid">${invoice.number}</span>` : ''}
          </div>
        </div>
        ${invoice ? '' : `<button type="button" data-action="invoice" data-order-id="${order.id}">Générer facture</button>`}
      </article>
    `;
  }).join('') : emptyState('Aucune commande enregistrée.');
}

function renderInvoices() {
  const container = safeSelect('invoicesList');
  if (!container) return;
  container.innerHTML = state.invoices.length ? state.invoices.map((invoice) => {
    const order = getOrderById(invoice.orderId);
    const paidAmount = getInvoicePaidAmount(invoice.id);
    const remaining = Math.max(Number(invoice.amount || 0) - paidAmount, 0);
    return `
      <article class="item">
        <div class="item-main">
          <strong>${invoice.number}</strong>
          <p>Commande #${invoice.orderId} - ${getCustomerById(order?.customerId)?.name || 'Client inconnu'}</p>
          <div class="item-meta">
            <span class="tag ${tagClass(invoice.status)}">${invoice.status}</span>
            <span class="tag">Montant ${formatCurrency(invoice.amount)}</span>
            <span class="tag">Reste ${formatCurrency(remaining)}</span>
          </div>
        </div>
      </article>
    `;
  }).join('') : emptyState('Aucune facture générée.');
}

function renderPayments() {
  const container = safeSelect('paymentsList');
  if (!container) return;
  container.innerHTML = state.payments.length ? state.payments.map((payment) => {
    const invoice = getInvoiceById(payment.invoiceId);
    return `
      <article class="item">
        <div class="item-main">
          <strong>Paiement #${payment.id}</strong>
          <p>${invoice?.number || `Facture #${payment.invoiceId}`} - ${formatCurrency(payment.amount)}</p>
          <div class="item-meta">
            <span class="tag">${payment.method}</span>
            <span class="tag">${payment.date}</span>
          </div>
        </div>
      </article>
    `;
  }).join('') : emptyState('Aucun paiement enregistré.');
}

function renderReports() {
  const reportCards = safeSelect('reportCards');
  const invoiceAging = safeSelect('invoiceAging');
  const auditLog = safeSelect('auditLog');
  if (!reportCards || !invoiceAging || !auditLog) return;

  const invoiced = state.invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const paid = state.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const outstanding = Math.max(invoiced - paid, 0);
  const validatedOrders = state.orders.filter((order) => order.status === 'Validée').length;

  reportCards.innerHTML = `
    <article class="card"><span class="kpi-value">${formatCurrency(invoiced)}</span><span class="kpi-label">Total facturé</span></article>
    <article class="card"><span class="kpi-value">${formatCurrency(paid)}</span><span class="kpi-label">Total encaissé</span></article>
    <article class="card"><span class="kpi-value">${formatCurrency(outstanding)}</span><span class="kpi-label">Solde ouvert</span></article>
    <article class="card"><span class="kpi-value">${validatedOrders}</span><span class="kpi-label">Commandes validées</span></article>
    <article class="card"><span class="kpi-value">${state.invoices.length}</span><span class="kpi-label">Factures</span></article>
    <article class="card"><span class="kpi-value">${state.auditLog.length}</span><span class="kpi-label">Événements audit</span></article>
  `;

  invoiceAging.innerHTML = `
    <table>
      <thead><tr><th>Facture</th><th>Client</th><th>Montant</th><th>Payé</th><th>Solde</th><th>Statut</th></tr></thead>
      <tbody>${state.invoices.map((invoice) => {
        const order = getOrderById(invoice.orderId);
        const paidAmount = getInvoicePaidAmount(invoice.id);
        return `<tr>
          <td>${invoice.number}</td>
          <td>${getCustomerById(order?.customerId)?.name || 'Client inconnu'}</td>
          <td>${formatCurrency(invoice.amount)}</td>
          <td>${formatCurrency(paidAmount)}</td>
          <td>${formatCurrency(Math.max(invoice.amount - paidAmount, 0))}</td>
          <td>${invoice.status}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  `;

  auditLog.innerHTML = `
    <table>
      <thead><tr><th>Date</th><th>Module</th><th>Action</th><th>Détail</th></tr></thead>
      <tbody>${state.auditLog.map((entry) => `<tr><td>${entry.date}</td><td>${entry.module}</td><td>${entry.action}</td><td>${entry.detail}</td></tr>`).join('')}</tbody>
    </table>
  `;
}

function renderSelects() {
  const customerSelect = safeSelect('orderCustomer');
  const productSelect = safeSelect('orderProduct');
  const invoiceSelect = safeSelect('paymentInvoice');

  if (customerSelect) {
    customerSelect.innerHTML = state.customers
      .filter((customer) => customer.status !== 'Inactif')
      .map((customer) => `<option value="${customer.id}">${customer.name}</option>`)
      .join('');
  }

  if (productSelect) {
    productSelect.innerHTML = state.products
      .filter((product) => product.status !== 'Inactif')
      .map((product) => `<option value="${product.id}">${product.name} (${formatCurrency(product.price)})</option>`)
      .join('');
  }

  if (invoiceSelect) {
    const openInvoices = state.invoices.filter((invoice) => invoice.status !== 'Payée');
    invoiceSelect.innerHTML = openInvoices.length
      ? openInvoices.map((invoice) => `<option value="${invoice.id}">${invoice.number} - ${formatCurrency(Math.max(invoice.amount - getInvoicePaidAmount(invoice.id), 0))}</option>`).join('')
      : '<option value="">Aucune facture ouverte</option>';
  }
}

async function createInvoice(orderId) {
  if (dataSource === 'oracle') {
    await postOrds(`/orders/${orderId}/invoice`, {});
    await refreshOracleSnapshot();
    return;
  }

  const order = getOrderById(orderId);
  if (!order || state.invoices.some((invoice) => Number(invoice.orderId) === Number(orderId))) return;

  const invoiceId = nextId(state.invoices);
  state.invoices.push({
    id: invoiceId,
    orderId: Number(orderId),
    number: `INV-${String(invoiceId).padStart(3, '0')}`,
    amount: Number(order.amount || 0),
    status: 'Ouverte'
  });
  order.status = 'Validée';
  logAction('INVOICE', 'GENERATE', `Facture INV-${String(invoiceId).padStart(3, '0')} générée depuis commande #${orderId}`, false);
  saveState();
  render();
}

async function recordPayment(invoiceId, amount, method) {
  if (dataSource === 'oracle') {
    await postOrds('/payments', { invoice_id: invoiceId, amount, payment_method: method });
    await refreshOracleSnapshot();
    return;
  }

  const invoice = getInvoiceById(invoiceId);
  const paidAmount = Number(amount || 0);
  if (!invoice || paidAmount <= 0) return;

  state.payments.push({
    id: nextId(state.payments),
    invoiceId: Number(invoiceId),
    amount: paidAmount,
    method,
    date: new Date().toISOString().slice(0, 10)
  });

  if (getInvoicePaidAmount(invoiceId) >= Number(invoice.amount || 0)) {
    invoice.status = 'Payée';
  }

  logAction('PAYMENT', 'REGISTER', `Paiement de ${formatCurrency(paidAmount)} sur ${invoice.number}`, false);
  saveState();
  render();
}

function exportCsv() {
  const rows = [
    ['invoice_number', 'customer', 'amount', 'paid', 'remaining', 'status'],
    ...state.invoices.map((invoice) => {
      const order = getOrderById(invoice.orderId);
      const paidAmount = getInvoicePaidAmount(invoice.id);
      return [
        invoice.number,
        getCustomerById(order?.customerId)?.name || 'Client inconnu',
        invoice.amount,
        paidAmount,
        Math.max(invoice.amount - paidAmount, 0),
        invoice.status
      ];
    })
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'gestion-commerciale-factures.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  logAction('REPORTING', 'EXPORT_CSV', 'Export CSV des factures et soldes');
  render();
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
      button.classList.add('active');
      safeSelect(button.dataset.view)?.classList.add('active');
    });
  });

  safeSelect('resetDemo')?.addEventListener('click', resetState);

  safeSelect('saveApiKey')?.addEventListener('click', async () => {
    const input = safeSelect('apiKeyInput');
    if (!input || !saveApiKey(input.value)) {
      dataSource = 'local';
      dataSourceError = 'API key vide';
      render();
      return;
    }
    await refreshOracleSnapshot();
    input.value = '';
  });

  safeSelect('clearApiKey')?.addEventListener('click', () => {
    clearApiKey();
    dataSource = 'local';
    dataSourceError = 'session deconnectee';
    render();
  });

  safeSelect('addCustomer')?.addEventListener('click', async () => {
    const name = safeSelect('customerName')?.value.trim();
    const contact = safeSelect('customerContact')?.value.trim();
    if (!name) return;
    if (dataSource === 'oracle') {
      await postOrds('/customers', { customer_name: name, email: contact });
      await refreshOracleSnapshot();
      safeSelect('customerForm')?.reset();
      return;
    }
    state.customers.push({ id: nextId(state.customers), name, contact, status: 'Actif' });
    logAction('CUSTOMER', 'CREATE', `Client ${name} créé`, false);
    saveState();
    render();
    safeSelect('customerForm')?.reset();
  });

  safeSelect('addProduct')?.addEventListener('click', () => {
    const name = safeSelect('productName')?.value.trim();
    const price = Number(safeSelect('productPrice')?.value || 0);
    if (!name || price <= 0) return;
    state.products.push({ id: nextId(state.products), name, price, status: 'Actif' });
    logAction('PRODUCT', 'CREATE', `Produit ${name} ajouté à ${formatCurrency(price)}`, false);
    saveState();
    render();
    safeSelect('productForm')?.reset();
  });

  safeSelect('addOrder')?.addEventListener('click', async () => {
    const customerId = Number(safeSelect('orderCustomer')?.value);
    const productId = Number(safeSelect('orderProduct')?.value);
    const quantity = Number(safeSelect('orderQty')?.value || 1);
    const product = getProductById(productId);
    if (!customerId || !product || quantity <= 0) return;

    if (dataSource === 'oracle') {
      await postOrds('/orders', { customer_id: customerId, product_id: productId, quantity });
      await refreshOracleSnapshot();
      safeSelect('orderForm')?.reset();
      safeSelect('orderQty').value = 1;
      return;
    }

    state.orders.push({
      id: nextId(state.orders),
      customerId,
      productId,
      quantity,
      amount: product.price * quantity,
      status: 'Validée'
    });
    logAction('ORDER', 'CREATE', `Commande créée pour ${getCustomerById(customerId)?.name || 'client'} avec ${quantity} x ${product.name}`, false);
    saveState();
    render();
    safeSelect('orderForm')?.reset();
    safeSelect('orderQty').value = 1;
  });

  safeSelect('addPayment')?.addEventListener('click', async () => {
    const invoiceId = Number(safeSelect('paymentInvoice')?.value);
    const amount = Number(safeSelect('paymentAmount')?.value || 0);
    const method = safeSelect('paymentMethod')?.value || 'Virement';
    await recordPayment(invoiceId, amount, method);
    safeSelect('paymentForm')?.reset();
  });

  safeSelect('exportCsv')?.addEventListener('click', exportCsv);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="invoice"]');
    if (!button) return;
    createInvoice(Number(button.dataset.orderId));
  });
}

function boot() {
  bindEvents();
  state = clone(defaultState);
  render();
  const apiKeyInput = safeSelect('apiKeyInput');
  if (apiKeyInput && getApiKey()) {
    apiKeyInput.placeholder = 'API key en session (masquee)';
  }
  loadState().then(render);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
