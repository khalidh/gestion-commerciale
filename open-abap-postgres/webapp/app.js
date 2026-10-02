sap.ui.define([
  'sap/f/ShellBar',
  'sap/m/App',
  'sap/m/Button',
  'sap/m/Column',
  'sap/m/ColumnListItem',
  'sap/m/Dialog',
  'sap/m/HBox',
  'sap/m/IconTabBar',
  'sap/m/IconTabFilter',
  'sap/m/Input',
  'sap/m/Label',
  'sap/m/MessageBox',
  'sap/m/MessageStrip',
  'sap/m/MessageToast',
  'sap/m/ObjectStatus',
  'sap/m/ObjectNumber',
  'sap/m/Page',
  'sap/m/Panel',
  'sap/m/SearchField',
  'sap/m/Select',
  'sap/m/Table',
  'sap/m/Text',
  'sap/m/Title',
  'sap/m/Toolbar',
  'sap/m/ToolbarSpacer',
  'sap/m/VBox',
  'sap/ui/core/Item',
  'sap/ui/model/Filter',
  'sap/ui/model/FilterOperator',
  'sap/ui/model/json/JSONModel',
], function (
  ShellBar,
  App,
  Button,
  Column,
  ColumnListItem,
  Dialog,
  HBox,
  IconTabBar,
  IconTabFilter,
  Input,
  Label,
  MessageBox,
  MessageStrip,
  MessageToast,
  ObjectStatus,
  ObjectNumber,
  Page,
  Panel,
  SearchField,
  Select,
  Table,
  Text,
  Title,
  Toolbar,
  ToolbarSpacer,
  VBox,
  Item,
  Filter,
  FilterOperator,
  JSONModel,
) {
  'use strict';

  const apiUrl = '/api/customers';
  const model = new JSONModel({ customers: [], products: [], orders: [], invoices: [], payments: [], openInvoices: [], summary: {} });

  function formatMoney(value, currency = 'EUR') {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Number(value || 0));
  }

  function formatDate(value) {
    const date = String(value || '');
    return /^\d{8}$/.test(date) ? `${date.slice(6, 8)}/${date.slice(4, 6)}/${date.slice(0, 4)}` : date;
  }

  function statusText(value) {
    return ({ DRAFT: 'Brouillon', VALIDATED: 'Validée', OPEN: 'Ouverte', PAID: 'Payée', CANCELLED: 'Annulée' })[value] || value;
  }

  function statusState(value) {
    return ['VALIDATED', 'PAID', 'ACTIVE', 'RECONCILED'].includes(value) ? 'Success' :
      ['DRAFT', 'OPEN', 'REGISTERED'].includes(value) ? 'Warning' : 'None';
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    return response.status === 204 ? null : response.json();
  }

  async function refresh() {
    const [customers, products, orders, invoices, payments] = await Promise.all([
      request('/api/customers'),
      request('/api/products'),
      request('/api/orders'),
      request('/api/invoices'),
      request('/api/payments'),
    ]);
    model.setProperty('/customers', customers);
    model.setProperty('/products', products);
    model.setProperty('/orders', orders);
    model.setProperty('/invoices', invoices);
    model.setProperty('/payments', payments);
    model.setProperty('/openInvoices', invoices.filter((invoice) => Number(invoice.remaining_amount) > 0));
    model.setProperty('/summary', {
      customers: customers.length,
      products: products.length,
      orders: orders.length,
      invoices: invoices.length,
      paid: payments.reduce((sum, payment) => sum + Number(payment.payment_amount || 0), 0),
      outstanding: invoices.reduce((sum, invoice) => sum + Number(invoice.remaining_amount || 0), 0),
    });
    if (orderCustomerSelect && !orderCustomerSelect.getSelectedKey() && customers[0]) {
      orderCustomerSelect.setSelectedKey(customers[0].customer_id);
    }
    if (orderProductSelect && !orderProductSelect.getSelectedKey() && products[0]) {
      orderProductSelect.setSelectedKey(products[0].product_id);
    }
    if (invoiceSelect && !invoiceSelect.getSelectedKey() && model.getProperty('/openInvoices')[0]) {
      invoiceSelect.setSelectedKey(model.getProperty('/openInvoices')[0].invoice_id);
    }
  }

  function showError(error) {
    MessageBox.error(error.message || 'La requête a échoué.');
  }

  function editorDialog(customer) {
    const isExisting = Boolean(customer?.customer_id);
    const name = new Input({ value: customer?.customer_name || '', maxLength: 80, required: true });
    const email = new Input({ value: customer?.customer_email || '', maxLength: 100, type: 'Email' });
    const dialog = new Dialog({
      title: isExisting ? 'Modifier le client' : 'Nouveau client',
      contentWidth: '30rem',
      content: [
        new Label({ text: 'Nom', labelFor: name }),
        name,
        new Label({ text: 'E-mail', labelFor: email }),
        email,
      ],
      beginButton: new Button({
        text: 'Enregistrer',
        type: 'Emphasized',
        press: async () => {
          if (!name.getValue().trim()) {
            name.setValueState('Error');
            name.setValueStateText('Le nom est obligatoire.');
            return;
          }
          try {
            const body = JSON.stringify({
              customer_name: name.getValue(),
              customer_email: email.getValue(),
            });
            await request(isExisting ? `${apiUrl}/${encodeURIComponent(customer.customer_id)}` : apiUrl, {
              method: isExisting ? 'PUT' : 'POST',
              body,
            });
            await refresh();
            dialog.close();
            if (!isExisting) {
              sap.ui.getCore().byId('newCustomerName').setValue('');
              sap.ui.getCore().byId('newCustomerEmail').setValue('');
            }
            MessageToast.show(isExisting ? 'Client modifié' : 'Client créé');
          } catch (error) {
            showError(error);
          }
        },
      }),
      endButton: new Button({ text: 'Annuler', press: () => dialog.close() }),
      afterClose: () => dialog.destroy(),
    });
    dialog.open();
  }

  function productDialog(product) {
    const isExisting = Boolean(product?.product_id);
    const code = new Input({ value: product?.product_code || '', maxLength: 30, enabled: !isExisting });
    const name = new Input({ value: product?.product_name || '', maxLength: 200, required: true });
    const price = new Input({ value: product ? String(product.unit_price) : '', type: 'Number', min: 0 });
    const currency = new Input({ value: product?.currency_code || 'EUR', maxLength: 3 });
    const dialog = new Dialog({
      title: isExisting ? 'Modifier le produit' : 'Nouveau produit',
      contentWidth: '32rem',
      content: [
        new Label({ text: 'Code', labelFor: code }),
        code,
        new Label({ text: 'Nom', labelFor: name }),
        name,
        new Label({ text: 'Prix unitaire', labelFor: price }),
        price,
        new Label({ text: 'Devise', labelFor: currency }),
        currency,
      ],
      beginButton: new Button({
        text: 'Enregistrer',
        type: 'Emphasized',
        press: async () => {
          const unitPrice = Number(price.getValue());
          if (!name.getValue().trim() || !Number.isFinite(unitPrice) || unitPrice < 0) {
            MessageBox.warning('Vérifie le nom et le prix du produit.');
            return;
          }
          try {
            const body = JSON.stringify({
              product_code: code.getValue(),
              product_name: name.getValue(),
              unit_price: unitPrice,
              currency_code: currency.getValue(),
              status: product?.status || 'ACTIVE',
            });
            await request(isExisting ? `/api/products/${encodeURIComponent(product.product_id)}` : '/api/products', {
              method: isExisting ? 'PUT' : 'POST',
              body,
            });
            await refresh();
            dialog.close();
            MessageToast.show(isExisting ? 'Produit modifié' : 'Produit créé');
          } catch (error) {
            showError(error);
          }
        },
      }),
      endButton: new Button({ text: 'Annuler', press: () => dialog.close() }),
      afterClose: () => dialog.destroy(),
    });
    dialog.open();
  }

  const table = new Table({
    growing: true,
    growingScrollToLoad: true,
    noDataText: 'Aucun client',
    columns: [
      new Column({ width: '18rem', header: new Text({ text: 'Client' }) }),
      new Column({ minScreenWidth: 'tablet', demandPopin: true, header: new Text({ text: 'E-mail' }) }),
      new Column({ width: '9rem', header: new Text({ text: 'Statut' }) }),
      new Column({ width: '7rem', hAlign: 'End', header: new Text({ text: 'Actions' }) }),
    ],
    items: {
      path: '/customers',
      template: new ColumnListItem({
        cells: [
          new Text({ text: '{customer_name}', wrapping: true }),
          new Text({ text: '{customer_email}', wrapping: true }),
          new ObjectStatus({ text: '{status}', state: 'Success' }),
          new HBox({
            justifyContent: 'End',
            items: [
              new Button({
                icon: 'sap-icon://edit',
                type: 'Transparent',
                tooltip: 'Modifier',
                press: (event) => editorDialog(event.getSource().getBindingContext().getObject()),
              }),
              new Button({
                icon: 'sap-icon://delete',
                type: 'Transparent',
                tooltip: 'Supprimer',
                press: (event) => {
                  const customer = event.getSource().getBindingContext().getObject();
                  MessageBox.confirm(`Supprimer ${customer.customer_name} ?`, {
                    onClose: async (action) => {
                      if (action !== MessageBox.Action.OK) return;
                      try {
                        await request(`${apiUrl}/${encodeURIComponent(customer.customer_id)}`, { method: 'DELETE' });
                        await refresh();
                        MessageToast.show('Client supprimé');
                      } catch (error) {
                        showError(error);
                      }
                    },
                  });
                },
              }),
            ],
          }),
        ],
      }),
    },
  });

  const search = new SearchField({
    width: '18rem',
    placeholder: 'Rechercher un client',
    liveChange: (event) => {
      const query = event.getParameter('newValue').trim();
      const binding = table.getBinding('items');
      binding.filter(query ? new Filter({
        filters: [
          new Filter('customer_name', FilterOperator.Contains, query),
          new Filter('customer_email', FilterOperator.Contains, query),
        ],
        and: false,
      }) : []);
    },
  });

  const productTable = new Table({
    growing: true,
    growingScrollToLoad: true,
    noDataText: 'Aucun produit',
    columns: [
      new Column({ width: '9rem', header: new Text({ text: 'Code' }) }),
      new Column({ width: '18rem', header: new Text({ text: 'Produit' }) }),
      new Column({ width: '9rem', hAlign: 'End', header: new Text({ text: 'Prix unitaire' }) }),
      new Column({ width: '6rem', header: new Text({ text: 'Devise' }) }),
      new Column({ width: '8rem', header: new Text({ text: 'Statut' }) }),
      new Column({ width: '7rem', hAlign: 'End', header: new Text({ text: 'Actions' }) }),
    ],
    items: {
      path: '/products',
      template: new ColumnListItem({
        cells: [
          new Text({ text: '{product_code}' }),
          new Text({ text: '{product_name}', wrapping: true }),
          new Text({ text: { path: 'unit_price', formatter: (value) => formatMoney(value) } }),
          new Text({ text: '{currency_code}' }),
          new ObjectStatus({
            text: { path: 'status', formatter: (status) => status === 'ACTIVE' ? 'Actif' : 'Inactif' },
            state: { path: 'status', formatter: (status) => status === 'ACTIVE' ? 'Success' : 'Warning' },
          }),
          new HBox({
            justifyContent: 'End',
            items: [
              new Button({
                icon: 'sap-icon://edit',
                type: 'Transparent',
                tooltip: 'Modifier',
                press: (event) => productDialog(event.getSource().getBindingContext().getObject()),
              }),
              new Button({
                icon: 'sap-icon://delete',
                type: 'Transparent',
                tooltip: 'Supprimer',
                press: (event) => {
                  const current = event.getSource().getBindingContext().getObject();
                  MessageBox.confirm(`Supprimer ${current.product_name} ?`, {
                    onClose: async (action) => {
                      if (action !== MessageBox.Action.OK) return;
                      try {
                        await request(`/api/products/${encodeURIComponent(current.product_id)}`, { method: 'DELETE' });
                        await refresh();
                        MessageToast.show('Produit supprimé');
                      } catch (error) {
                        showError(error);
                      }
                    },
                  });
                },
              }),
            ],
          }),
        ],
      }),
    },
  });

  const productSearch = new SearchField({
    width: '18rem',
    placeholder: 'Rechercher un produit',
    liveChange: (event) => {
      const query = event.getParameter('newValue').trim();
      const binding = productTable.getBinding('items');
      binding.filter(query ? new Filter({
        filters: [
          new Filter('product_code', FilterOperator.Contains, query),
          new Filter('product_name', FilterOperator.Contains, query),
        ],
        and: false,
      }) : []);
    },
  });

  let orderCustomerSelect;
  let orderProductSelect;
  let invoiceSelect;
  let quantityInput;
  let paymentAmountInput;
  let paymentMethodSelect;

  async function createOrder() {
    const customerId = orderCustomerSelect.getSelectedKey();
    const productId = orderProductSelect.getSelectedKey();
    const quantity = Number(quantityInput.getValue());
    if (!customerId || !productId || !Number.isFinite(quantity) || quantity <= 0) {
      MessageBox.warning('Sélectionne un client, un produit et une quantité positive.');
      return;
    }
    try {
      await request('/api/orders', { method: 'POST', body: JSON.stringify({ customer_id: customerId, product_id: productId, quantity }) });
      await refresh();
      MessageToast.show('Commande créée en brouillon');
    } catch (error) {
      showError(error);
    }
  }

  async function validateOrder(order) {
    try {
      await request(`/api/orders/${encodeURIComponent(order.sales_order_id)}/validate`, { method: 'POST', body: '{}' });
      await refresh();
      MessageToast.show('Commande validée');
    } catch (error) {
      showError(error);
    }
  }

  async function generateInvoice(order) {
    try {
      await request(`/api/orders/${encodeURIComponent(order.sales_order_id)}/invoice`, { method: 'POST', body: '{}' });
      await refresh();
      MessageToast.show('Facture générée');
    } catch (error) {
      showError(error);
    }
  }

  async function recordPayment() {
    const invoiceId = invoiceSelect.getSelectedKey();
    const amount = Number(paymentAmountInput.getValue());
    if (!invoiceId || !Number.isFinite(amount) || amount <= 0) {
      MessageBox.warning('Sélectionne une facture et saisis un montant positif.');
      return;
    }
    try {
      await request(`/api/invoices/${encodeURIComponent(invoiceId)}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount, payment_method: paymentMethodSelect.getSelectedKey() }),
      });
      await refresh();
      paymentAmountInput.setValue('');
      MessageToast.show('Paiement enregistré');
    } catch (error) {
      showError(error);
    }
  }

  const orderTable = new Table({
    growing: true,
    noDataText: 'Aucune commande',
    columns: [
      new Column({ width: '11rem', header: new Text({ text: 'Commande' }) }),
      new Column({ width: '14rem', header: new Text({ text: 'Client' }) }),
      new Column({ minScreenWidth: 'tablet', demandPopin: true, header: new Text({ text: 'Produits' }) }),
      new Column({ width: '10rem', header: new Text({ text: 'Statut' }) }),
      new Column({ width: '10rem', hAlign: 'End', header: new Text({ text: 'Total' }) }),
      new Column({ width: '15rem', hAlign: 'End', header: new Text({ text: 'Parcours' }) }),
    ],
    items: {
      path: '/orders',
      template: new ColumnListItem({
        cells: [
          new Text({ text: '{order_number}' }),
          new Text({ text: '{customer_name}', wrapping: true }),
          new Text({ text: '{products}', wrapping: true }),
          new ObjectStatus({ text: { path: 'order_status', formatter: statusText }, state: { path: 'order_status', formatter: statusState } }),
          new Text({ text: { path: 'total_amount', formatter: formatMoney } }),
          new HBox({
            justifyContent: 'End',
            items: [
              new Button({ text: 'Valider', enabled: { path: 'order_status', formatter: (status) => status === 'DRAFT' }, press: (event) => validateOrder(event.getSource().getBindingContext().getObject()) }),
              new Button({ text: 'Facturer', enabled: { parts: [{ path: 'order_status' }, { path: 'invoice_id' }], formatter: (status, invoiceId) => status === 'VALIDATED' && !invoiceId }, press: (event) => generateInvoice(event.getSource().getBindingContext().getObject()) }),
            ],
          }),
        ],
      }),
    },
  });

  const invoiceTable = new Table({
    growing: true,
    noDataText: 'Aucune facture',
    columns: [
      new Column({ width: '11rem', header: new Text({ text: 'Facture' }) }),
      new Column({ width: '14rem', header: new Text({ text: 'Client' }) }),
      new Column({ width: '11rem', header: new Text({ text: 'Commande' }) }),
      new Column({ width: '9rem', hAlign: 'End', header: new Text({ text: 'Total' }) }),
      new Column({ width: '9rem', hAlign: 'End', header: new Text({ text: 'Encaissé' }) }),
      new Column({ width: '9rem', hAlign: 'End', header: new Text({ text: 'Solde' }) }),
      new Column({ width: '9rem', header: new Text({ text: 'Statut' }) }),
    ],
    items: {
      path: '/invoices',
      template: new ColumnListItem({
        cells: [
          new Text({ text: '{invoice_number}' }),
          new Text({ text: '{customer_name}', wrapping: true }),
          new Text({ text: '{sales_order_id}' }),
          new Text({ text: { path: 'total_amount', formatter: formatMoney } }),
          new Text({ text: { path: 'paid_amount', formatter: formatMoney } }),
          new Text({ text: { path: 'remaining_amount', formatter: formatMoney } }),
          new ObjectStatus({ text: { path: 'invoice_status', formatter: statusText }, state: { path: 'invoice_status', formatter: statusState } }),
        ],
      }),
    },
  });

  const paymentTable = new Table({
    growing: true,
    noDataText: 'Aucun paiement',
    columns: [
      new Column({ width: '11rem', header: new Text({ text: 'Facture' }) }),
      new Column({ width: '16rem', header: new Text({ text: 'Client' }) }),
      new Column({ width: '10rem', hAlign: 'End', header: new Text({ text: 'Montant' }) }),
      new Column({ width: '10rem', header: new Text({ text: 'Mode' }) }),
      new Column({ width: '10rem', header: new Text({ text: 'Statut' }) }),
    ],
    items: {
      path: '/payments',
      template: new ColumnListItem({
        cells: [
          new Text({ text: '{invoice_number}' }),
          new Text({ text: '{customer_name}', wrapping: true }),
          new Text({ text: { path: 'payment_amount', formatter: formatMoney } }),
          new Text({ text: '{payment_method}' }),
          new ObjectStatus({ text: { path: 'payment_status', formatter: statusText }, state: { path: 'payment_status', formatter: statusState } }),
        ],
      }),
    },
  });

  orderCustomerSelect = new Select({
    width: '15rem',
    items: { path: '/customers', template: new Item({ key: '{customer_id}', text: '{customer_name}' }) },
  });
  orderProductSelect = new Select({
    width: '15rem',
    items: { path: '/products', template: new Item({ key: '{product_id}', text: '{product_name}' }) },
  });
  quantityInput = new Input({ type: 'Number', value: '1', min: 0.01, step: 0.01, width: '8rem' });
  invoiceSelect = new Select({
    width: '25rem',
    items: { path: '/openInvoices', template: new Item({ key: '{invoice_id}', text: '{invoice_number} · {customer_name} · {remaining_amount}' }) },
  });
  paymentAmountInput = new Input({ type: 'Number', min: 0.01, step: 0.01, width: '10rem' });
  paymentMethodSelect = new Select({
    width: '12rem',
    selectedKey: 'TRANSFER',
    items: [
      new Item({ key: 'TRANSFER', text: 'Virement' }),
      new Item({ key: 'CARD', text: 'Carte' }),
      new Item({ key: 'CHEQUE', text: 'Chèque' }),
    ],
  });

  const orderPanel = new Panel({
    content: [new HBox({
      wrap: 'Wrap',
      alignItems: 'End',
      items: [
        new Label({ text: 'Client' }), orderCustomerSelect,
        new Label({ text: 'Produit' }), orderProductSelect,
        new Label({ text: 'Quantité' }), quantityInput,
        new Button({ text: 'Créer commande', icon: 'sap-icon://add', type: 'Emphasized', press: createOrder }),
      ],
    })],
  }).addStyleClass('customerFormPanel');

  const paymentPanel = new Panel({
    content: [new HBox({
      wrap: 'Wrap',
      alignItems: 'End',
      items: [
        new Label({ text: 'Facture ouverte' }), invoiceSelect,
        new Label({ text: 'Montant' }), paymentAmountInput,
        new Label({ text: 'Mode' }), paymentMethodSelect,
        new Button({ text: 'Enregistrer paiement', icon: 'sap-icon://money-bills', type: 'Emphasized', press: recordPayment }),
      ],
    })],
  }).addStyleClass('customerFormPanel');

  const summaryPanel = new Panel({
    headerText: 'Indicateurs commerciaux',
    content: [new HBox({
      wrap: 'Wrap',
      justifyContent: 'SpaceAround',
      items: [
        new ObjectNumber({ number: '{/summary/customers}', unit: 'clients' }),
        new ObjectNumber({ number: '{/summary/products}', unit: 'produits' }),
        new ObjectNumber({ number: '{/summary/orders}', unit: 'commandes' }),
        new ObjectNumber({ number: '{/summary/invoices}', unit: 'factures' }),
        new ObjectNumber({ number: { path: '/summary/paid', formatter: formatMoney }, unit: 'encaissé' }),
        new ObjectNumber({ number: { path: '/summary/outstanding', formatter: formatMoney }, unit: 'à encaisser' }),
      ],
    })],
  });

  const shellBar = new ShellBar({
    title: 'Gestion commerciale',
    secondTitle: 'Clients · OpenABAP / PostgreSQL',
    showNavButton: false,
  });

  const page = new Page({
    customHeader: shellBar,
    content: [
      new IconTabBar({
        expandable: false,
        items: [
          new IconTabFilter({
            key: 'customers',
            text: 'Clients',
            icon: 'sap-icon://customer',
            content: [
      new Panel({
        width: '100%',
        content: [
          new HBox({
            wrap: 'Wrap',
            alignItems: 'End',
            items: [
              new Label({ text: 'Nom du client' }),
              new Input({ id: 'newCustomerName', width: '18rem', maxLength: 80, placeholder: 'Ex. Contoso France' }),
              new Label({ text: 'E-mail' }),
              new Input({ id: 'newCustomerEmail', width: '18rem', maxLength: 100, type: 'Email', placeholder: 'contact@exemple.fr' }),
              new Button({
                text: 'Ajouter',
                icon: 'sap-icon://add',
                type: 'Emphasized',
                press: () => {
                  const customerName = sap.ui.getCore().byId('newCustomerName').getValue();
                  if (!customerName.trim()) {
                    MessageBox.warning('Le nom du client est obligatoire.');
                    return;
                  }
                  editorDialog({
                    customer_name: customerName,
                    customer_email: sap.ui.getCore().byId('newCustomerEmail').getValue(),
                  });
                },
              }),
            ],
          }),
        ],
      }).addStyleClass('customerFormPanel'),
      new Toolbar({
        content: [
          new Title({ text: 'Clients', level: 'H2' }),
          new ToolbarSpacer(),
          search,
          new Button({ icon: 'sap-icon://refresh', type: 'Transparent', tooltip: 'Actualiser', press: () => refresh().catch(showError) }),
        ],
      }).addStyleClass('customerToolbar'),
      table.addStyleClass('customerTable'),
            ],
          }),
          new IconTabFilter({
            key: 'products',
            text: 'Produits',
            icon: 'sap-icon://product',
            content: [
              new Toolbar({
                content: [
                  new Title({ text: 'Produits', level: 'H2' }),
                  new ToolbarSpacer(),
                  productSearch,
                  new Button({
                    text: 'Nouveau produit',
                    icon: 'sap-icon://add',
                    type: 'Emphasized',
                    press: () => productDialog(),
                  }),
                  new Button({ icon: 'sap-icon://refresh', type: 'Transparent', tooltip: 'Actualiser', press: () => refresh().catch(showError) }),
                ],
              }).addStyleClass('customerToolbar'),
              productTable.addStyleClass('customerTable'),
            ],
          }),
          new IconTabFilter({
            key: 'orders',
            text: 'Commandes',
            icon: 'sap-icon://sales-order',
            content: [
              orderPanel,
              new Toolbar({
                content: [
                  new Title({ text: 'Commandes', level: 'H2' }),
                  new ToolbarSpacer(),
                  new Button({ icon: 'sap-icon://refresh', type: 'Transparent', tooltip: 'Actualiser', press: () => refresh().catch(showError) }),
                ],
              }).addStyleClass('customerToolbar'),
              orderTable.addStyleClass('customerTable'),
            ],
          }),
          new IconTabFilter({
            key: 'invoices',
            text: 'Factures',
            icon: 'sap-icon://sales-document',
            content: [
              new Toolbar({ content: [new Title({ text: 'Factures', level: 'H2' }), new ToolbarSpacer(), new Button({ icon: 'sap-icon://refresh', type: 'Transparent', tooltip: 'Actualiser', press: () => refresh().catch(showError) })] }).addStyleClass('customerToolbar'),
              invoiceTable.addStyleClass('customerTable'),
            ],
          }),
          new IconTabFilter({
            key: 'payments',
            text: 'Paiements',
            icon: 'sap-icon://money-bills',
            content: [
              paymentPanel,
              new Toolbar({ content: [new Title({ text: 'Paiements', level: 'H2' }), new ToolbarSpacer(), new Button({ icon: 'sap-icon://refresh', type: 'Transparent', tooltip: 'Actualiser', press: () => refresh().catch(showError) })] }).addStyleClass('customerToolbar'),
              paymentTable.addStyleClass('customerTable'),
            ],
          }),
          new IconTabFilter({
            key: 'summary',
            text: 'Synthèse',
            icon: 'sap-icon://business-objects-experience',
            content: [summaryPanel],
          }),
        ],
      }),
    ],
  }).addStyleClass('customerPage');

  const app = new App({ pages: [page] });
  app.setModel(model);
  app.placeAt('content');

  refresh().catch(showError);
});