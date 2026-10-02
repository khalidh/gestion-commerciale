import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const models = [
  { table: 'zgc_rap_cust', entity: 'zi_gccustomer', alias: 'Customer', key: 'CustomerUUID' },
  { table: 'zgc_rap_prod', entity: 'zi_gcproduct', alias: 'Product', key: 'ProductUUID' },
];
const read = (name) => readFile(new URL(`./src/${name}`, import.meta.url), 'utf8');
for (const model of models) {
  const table = await read(`${model.table}.tabl.asddl`);
  const view = await read(`${model.entity}.ddls.asddls`);
  const behavior = await read(`${model.entity}.bdef.asbdef`);
  assert.match(table, new RegExp(`define table ${model.table}\\s*\\{`, 'i'));
  assert.match(table, /key client\s*:\s*abap.clnt not null;/i);
  assert.match(view, new RegExp(`define root view entity ${model.entity}\\s+as select from ${model.table}`, 'i'));
  assert.match(behavior, new RegExp(`define behavior for ${model.entity} alias ${model.alias}`, 'i'));
  assert.match(behavior, /strict\s*\(\s*2\s*\)/i);
  assert.match(behavior, new RegExp(`persistent table ${model.table}`, 'i'));
  assert.match(behavior, new RegExp(`field \\( readonly, numbering : managed \\) ${model.key};`, 'i'));
  assert.match(behavior, /etag master LocalLastChangedAt/i);
  assert.match(behavior, /with draft;/i);
  assert.match(behavior, /lock master total etag LastChangedAt/i);
  const draft = await read(`${model.table}_d.tabl.asddl`);
  assert.match(draft, /"%admin"\s*:\s*include sych_bdl_draft_admin_inc;/i);
  const handler = await read(`zbp_i_${model.entity.slice(3)}.clas.locals_imp.abap`);
  assert.match(handler, new RegExp(`READ ENTITIES OF ${model.entity} IN LOCAL MODE`, 'i'));
  assert.match(handler, /AUTHORITY-CHECK OBJECT 'ZGC_MDATA'/);
  assert.match(handler, /result-%action-Edit = result-%update\./i);
  const fields = new Set([...table.matchAll(/^\s*(?:key\s+)?(\w+)\s*:/gm)].map((match) => match[1].toLowerCase()));
  const mappings = [...behavior.matchAll(/^\s*(\w+)\s*=\s*(\w+);/gm)];
  assert.equal(mappings.length, fields.size - 1, 'Every non-client table field must be mapped');
  assert.deepEqual(new Set(mappings.map(([, , field]) => field.toLowerCase())), new Set([...fields].filter((field) => field !== 'client')));
  const activeTypes = new Map([...table.matchAll(/^\s*(?:key\s+)?(\w+)\s*:\s*([^;]+);/gm)]
    .map(([, field, type]) => [field.toLowerCase(), type.replace(/\s+not null/i, '').trim().toLowerCase()]));
  const draftTypes = new Map([...draft.matchAll(/^\s*(?:key\s+)?(\w+)\s*:\s*([^;]+);/gm)]
    .map(([, field, type]) => [field.toLowerCase(), type.replace(/\s+not null/i, '').trim().toLowerCase()]));
  for (const [, alias, field] of mappings) {
    assert(fields.has(field.toLowerCase()), `Unknown persistent field: ${field}`);
    assert.match(view, new RegExp(`\\b${field} as ${alias}\\b`, 'i'));
    assert.match(draft, new RegExp(`\\b${alias}\\s*:`, 'i'));
    assert.equal(draftTypes.get(alias.toLowerCase()), activeTypes.get(field.toLowerCase()), `Draft type mismatch: ${alias}`);
  }
  for (const [, validation] of behavior.matchAll(/validation (\w+) on save/g)) {
    assert.match(handler, new RegExp(`METHODS ${validation} FOR VALIDATE ON SAVE`, 'i'));
    assert.match(handler, new RegExp(`METHOD ${validation}\\.`, 'i'));
  }
  const projectionName = model.entity.replace('zi_', 'zc_');
  const projection = await read(`${projectionName}.ddls.asddls`);
  const projectedBehavior = await read(`${projectionName}.bdef.asbdef`);
  const metadata = await read(`${projectionName}.ddlx.asddlxs`);
  const service = await read('zui_gc_master.srvd.srvdsrv');
  assert.match(projection, new RegExp(`as projection on ${model.entity}`, 'i'));
  assert.match(projection, /provider contract transactional_query/i);
  assert.match(projectedBehavior, /use draft;/i);
  assert.match(projectedBehavior, /use etag/i);
  assert.match(metadata, new RegExp(`annotate entity ${projectionName} with`, 'i'));
  assert.match(service, new RegExp(`expose ${projectionName} as ${model.alias}s;`, 'i'));
  for (const operation of ['create', 'update', 'delete']) {
    assert.match(projectedBehavior, new RegExp(`use ${operation};`, 'i'));
  }
  for (const action of ['Edit', 'Activate', 'Discard', 'Resume', 'Prepare']) {
    assert.match(projectedBehavior, new RegExp(`use action ${action};`, 'i'));
    assert.match(behavior, new RegExp(`draft (?:determine )?action ${action}\\b`, 'i'));
  }
  for (const [, alias] of mappings) {
    assert.match(projection, new RegExp(`\\b${alias}\\b`, 'i'));
    assert.match(metadata, new RegExp(`\\b${alias};`, 'i'));
  }
}
console.log('RAP source consistency checks passed. These checks are not SAP compilation or runtime tests.');