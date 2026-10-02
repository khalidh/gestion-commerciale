sap.ui.define([
  'sap/f/ShellBar',
  'sap/m/App',
  'sap/m/Button',
  'sap/m/Column',
  'sap/m/ColumnListItem',
  'sap/m/Dialog',
  'sap/m/HBox',
  'sap/m/Input',
  'sap/m/Label',
  'sap/m/MessageBox',
  'sap/m/MessageStrip',
  'sap/m/MessageToast',
  'sap/m/ObjectStatus',
  'sap/m/Page',
  'sap/m/Panel',
  'sap/m/SearchField',
  'sap/m/Table',
  'sap/m/Text',
  'sap/m/Title',
  'sap/m/Toolbar',
  'sap/m/ToolbarSpacer',
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
  Input,
  Label,
  MessageBox,
  MessageStrip,
  MessageToast,
  ObjectStatus,
  Page,
  Panel,
  SearchField,
  Table,
  Text,
  Title,
  Toolbar,
  ToolbarSpacer,
  Filter,
  FilterOperator,
  JSONModel,
) {
  'use strict';

  const apiUrl = '/api/customers';
  const model = new JSONModel({ customers: [] });

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
    model.setProperty('/customers', await request(apiUrl));
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

  const shellBar = new ShellBar({
    title: 'Gestion commerciale',
    secondTitle: 'Clients · OpenABAP / PostgreSQL',
    showNavButton: false,
  });

  const page = new Page({
    customHeader: shellBar,
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
  }).addStyleClass('customerPage');

  const app = new App({ pages: [page] });
  app.setModel(model);
  app.placeAt('content');

  refresh().catch(showError);
});