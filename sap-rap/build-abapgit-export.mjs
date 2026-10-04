import assert from 'node:assert/strict';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rapDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.join(rapDirectory, 'src');
const exportDirectory = path.join(rapDirectory, 'abapgit-export');
const exportSourceDirectory = path.join(exportDirectory, 'src');
const tableSourceDirectory = path.join(exportDirectory, 'table-ddl');
const xmlHeader = '<?xml version="1.0" encoding="utf-8"?>';
const asxNamespace = 'http://www.sap.com/abapxml';

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function objectXml(serializer, body) {
  return `${xmlHeader}\n<abapGit version="v1.0.0" serializer="LCL_OBJECT_${serializer}" serializer_version="v1.0.0">\n <asx:abap xmlns:asx="${asxNamespace}" version="1.0">\n  <asx:values>\n${body}\n  </asx:values>\n </asx:abap>\n</abapGit>\n`;
}

function tag(name, value) {
  return `    <${name}>${escapeXml(value)}</${name}>`;
}

function textElement(name, value, indent = '     ') {
  return `${indent}<${name}>${escapeXml(value)}</${name}>`;
}

function getLabel(source, fallback) {
  const match = source.match(/@EndUserText\.label\s*:\s*'((?:''|[^'])*)'/i);
  return match ? match[1].replaceAll("''", "'") : fallback;
}

function fieldType(typeExpression) {
  const type = typeExpression.trim().toLowerCase();
  const character = type.match(/^abap\.(char|numc|raw)\((\d+)\)$/);
  if (character) {
    const [, base, lengthText] = character;
    const length = Number(lengthText);
    const dataType = base.toUpperCase();
    return { dataType, intType: base === 'raw' ? 'X' : base === 'numc' ? 'N' : 'C', intLength: base === 'raw' ? length : length * 2, length };
  }

  const currency = type.match(/^abap\.(curr|dec|quan)\((\d+)\s*,\s*(\d+)\)$/);
  if (currency) {
    const [, base, lengthText, decimalsText] = currency;
    const length = Number(lengthText);
    const decimals = Number(decimalsText);
    return { dataType: base.toUpperCase(), intType: 'P', intLength: Math.floor((length + 2) / 2), length, decimals };
  }

  const builtIns = {
    'abap.clnt': { dataType: 'CLNT', intType: 'C', intLength: 6, length: 3 },
    'abap.cuky': { dataType: 'CUKY', intType: 'C', intLength: 10, length: 5 },
  };
  if (builtIns[type]) {
    return builtIns[type];
  }

  if (/^[a-z][a-z0-9_]*$/.test(type)) {
    return { rollName: type.toUpperCase() };
  }
  throw new Error(`Unsupported table field type: ${typeExpression}`);
}

function parseTable(source, fileName) {
  const declaration = source.match(/define\s+table\s+([a-z0-9_]+)\s*\{([\s\S]*?)\}/i);
  assert.ok(declaration, `Could not parse table declaration in ${fileName}`);

  const [, tableName, fieldSource] = declaration;
  const fields = [];
  let pendingCurrencyField;
  for (const line of fieldSource.split(/\r?\n/)) {
    const currencyAnnotation = line.match(/@Semantics\.amount\.currencyCode\s*:\s*'([a-z0-9_]+)\.([a-z0-9_]+)'/i);
    if (currencyAnnotation) {
      pendingCurrencyField = currencyAnnotation[2].toUpperCase();
      continue;
    }
    const field = line.match(/^\s*(key\s+)?(?:"([^"]+)"|([a-z0-9_]+))\s*:\s*(include\s+[a-z0-9_]+|(?:abap\.)?[a-z0-9_]+(?:\([^)]*\))?)(?:\s+(not\s+null))?\s*;/i);
    if (!field) {
      continue;
    }

    const [, isKey, quotedName, plainName, rawType, notNull] = field;
    const name = quotedName ?? plainName;
    const include = rawType.match(/^include\s+([a-z0-9_]+)$/i);
    if (include) {
      fields.push({ name: '.INCLUDE', groupName: name.toUpperCase(), includeName: include[1].toUpperCase() });
      continue;
    }

    fields.push({
      name: name.toUpperCase(),
      key: Boolean(isKey),
      notNull: Boolean(notNull),
      ...fieldType(rawType),
      currencyField: pendingCurrencyField,
    });
    pendingCurrencyField = undefined;
  }
  assert.ok(fields.length > 0, `No fields found in ${fileName}`);
  const declaredFieldCount = fieldSource.split(/\r?\n/).filter((line) => /^\s*(?:key\s+)?(?:"[^"]+"|[a-z0-9_]+)\s*:/i.test(line)).length;
  assert.equal(fields.length, declaredFieldCount, `Not all declared fields were parsed in ${fileName}`);
  const currencyAnnotationCount = (fieldSource.match(/@Semantics\.amount\.currencyCode\s*:/gi) ?? []).length;
  assert.equal(fields.filter((field) => field.currencyField).length, currencyAnnotationCount, `Not all currency references were parsed in ${fileName}`);
  return { tableName: tableName.toUpperCase(), label: getLabel(source, tableName), fields };
}

function padded(value) {
  return String(value).padStart(6, '0');
}

function serializeTable(source, fileName) {
  const table = parseTable(source, fileName);
  const fieldRows = table.fields.map((field) => {
    if (field.includeName) {
      return [
        '    <DD03P>',
        textElement('FIELDNAME', field.name),
        textElement('ADMINFIELD', '0'),
        textElement('PRECFIELD', field.includeName),
        textElement('MASK', '     S'),
        textElement('COMPTYPE', 'S'),
        textElement('GROUPNAME', field.groupName),
        '    </DD03P>',
      ].join('\n');
    }

    const values = [
      textElement('FIELDNAME', field.name),
      field.key ? textElement('KEYFLAG', 'X') : null,
      field.rollName ? textElement('ROLLNAME', field.rollName) : null,
      textElement('ADMINFIELD', '0'),
      field.notNull ? textElement('NOTNULL', 'X') : null,
      field.rollName ? textElement('COMPTYPE', 'E') : null,
      field.dataType ? textElement('INTTYPE', field.intType) : null,
      field.dataType ? textElement('INTLEN', padded(field.intLength)) : null,
      field.dataType ? textElement('DATATYPE', field.dataType) : null,
      field.length ? textElement('LENG', padded(field.length)) : null,
      field.decimals ? textElement('DECIMALS', padded(field.decimals)) : null,
      field.dataType ? textElement('MASK', `  ${field.dataType}`) : null,
      field.currencyField ? textElement('REFTABLE', table.tableName) : null,
      field.currencyField ? textElement('REFFIELD', field.currencyField) : null,
    ].filter(Boolean);
    return `    <DD03P>\n${values.join('\n')}\n    </DD03P>`;
  }).join('\n');

  const fieldsXml = [
    `   <DD02V>`,
    textElement('TABNAME', table.tableName),
    textElement('DDLANGUAGE', 'E'),
    textElement('TABCLASS', 'TRANSP'),
    textElement('CLIDEP', 'X'),
    textElement('DDTEXT', table.label),
    textElement('MASTERLANG', 'E'),
    textElement('CONTFLAG', 'A'),
    textElement('EXCLASS', '1'),
    `   </DD02V>`,
    `   <DD09L>`,
    textElement('TABNAME', table.tableName),
    textElement('AS4LOCAL', 'A'),
    textElement('TABKAT', '0'),
    textElement('TABART', 'APPL0'),
    textElement('BUFALLOW', 'N'),
    `   </DD09L>`,
    `   <DD03P_TABLE>\n${fieldRows}\n   </DD03P_TABLE>`,
    `   <DD05M_TABLE/>`,
    `   <DD08V_TABLE/>`,
    `   <DD12V/>`,
    `   <DD17V/>`,
    `   <DD35V_TALE/>`,
    `   <DD36M/>`,
    `   <I18N_LANGS/>`,
    `   <DD02_TEXTS/>`,
    `   <LONGTEXTS/>`,
    `   <SEGMENT_DEFINITIONS/>`,
    `   <TABL_EXTRAS/>`,
  ].join('\n');

  return objectXml('TABL', fieldsXml);
}

function serializeClass(fileName, source, hasTestClasses) {
  const className = fileName.replace(/\.clas\.abap$/i, '').toUpperCase();
  const behaviorDefinition = source.match(/FOR\s+BEHAVIOR\s+OF\s+([a-z0-9_]+)/i)?.[1]?.toUpperCase();
  const description = behaviorDefinition ? 'RAP behavior implementation' : 'Gestion commerciale RAP rules';
  const fields = [
    tag('CLSNAME', className),
    tag('LANGU', 'E'),
    tag('DESCRIPT', description),
    behaviorDefinition ? tag('CATEGORY', '06') : null,
    tag('STATE', '1'),
    tag('CLSCCINCL', 'X'),
    tag('FIXPT', 'X'),
    tag('UNICODE', '5'),
    hasTestClasses ? tag('WITH_UNIT_TESTS', 'X') : null,
    behaviorDefinition ? tag('CLSDEFINT', behaviorDefinition) : null,
  ].filter(Boolean).join('\n');
  return objectXml('CLAS', `   <VSEOCLASS>\n${fields}\n   </VSEOCLASS>`);
}

async function writeExportFile(relativePath, content) {
  const absolutePath = path.join(exportDirectory, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, 'utf8');
}

await mkdir(exportSourceDirectory, { recursive: true });
await mkdir(tableSourceDirectory, { recursive: true });

const sourceFiles = await readdir(sourceDirectory);
let generatedTableCount = 0;
let generatedMetadataCount = 0;

for (const fileName of sourceFiles) {
  const sourcePath = path.join(sourceDirectory, fileName);
  const source = await readFile(sourcePath, 'utf8');

  if (fileName.endsWith('.tabl.asddl')) {
    await writeExportFile(path.join('table-ddl', fileName), source);
    const objectName = fileName.replace(/\.tabl\.asddl$/i, '');
    await writeExportFile(path.join('src', `${objectName}.tabl.xml`), serializeTable(source, fileName));
    generatedTableCount += 1;
    continue;
  }

  await copyFile(sourcePath, path.join(exportSourceDirectory, fileName));

  if (fileName.endsWith('.clas.abap')) {
    const testClassesFile = fileName.replace(/\.clas\.abap$/i, '.clas.testclasses.abap');
    const hasTestClasses = sourceFiles.includes(testClassesFile);
    await writeExportFile(path.join('src', fileName.replace(/\.clas\.abap$/i, '.clas.xml')), serializeClass(fileName, source, hasTestClasses));
    generatedMetadataCount += 1;
  } else if (fileName.endsWith('.bdef.asbdef')) {
    const objectName = fileName.replace(/\.bdef\.asbdef$/i, '').toUpperCase();
    const body = [
      '   <BDEF>',
      tag('NAME', objectName),
      tag('TYPE', 'BDEF/BDO'),
      tag('DESCRIPTION', 'RAP behavior definition'),
      tag('DESCRIPTION_TEXT_LIMIT', '60'),
      tag('LANGUAGE', 'EN'),
      tag('MASTER_LANGUAGE', 'EN'),
      tag('ABAP_LANGU_VERSION', '5'),
      tag('SOURCE_TYPE', 'ABAP_SOURCE'),
      tag('SOURCE_FIXED_POINT_ARITHMETIC', 'true'),
      tag('SOURCE_UNICODE_CHECKS_ACTIVE', 'true'),
      '   </BDEF>',
    ].join('\n');
    await writeExportFile(path.join('src', fileName.replace(/\.bdef\.asbdef$/i, '.bdef.xml')), objectXml('BDEF', body));
    generatedMetadataCount += 1;
  } else if (fileName.endsWith('.ddls.asddls')) {
    const objectName = fileName.replace(/\.ddls\.asddls$/i, '').toUpperCase();
    const body = [
      '   <DDLS>',
      tag('DDLNAME', objectName),
      tag('DDLANGUAGE', 'E'),
      tag('DDTEXT', getLabel(source, objectName)),
      tag('SOURCE_TYPE', 'W'),
      '   </DDLS>',
    ].join('\n');
    await writeExportFile(path.join('src', fileName.replace(/\.ddls\.asddls$/i, '.ddls.xml')), objectXml('DDLS', body));
    generatedMetadataCount += 1;
  } else if (fileName.endsWith('.ddlx.asddlxs')) {
    const objectName = fileName.replace(/\.ddlx\.asddlxs$/i, '').toUpperCase();
    const body = [
      '   <DDLX>',
      '    <METADATA>',
      textElement('NAME', objectName),
      textElement('DESCRIPTION', getLabel(source, 'RAP Fiori metadata extension')),
      textElement('MASTER_LANGUAGE', 'EN'),
      '    </METADATA>',
      '   </DDLX>',
    ].join('\n');
    await writeExportFile(path.join('src', fileName.replace(/\.ddlx\.asddlxs$/i, '.ddlx.xml')), objectXml('DDLX', body));
    generatedMetadataCount += 1;
  } else if (fileName.endsWith('.srvd.srvdsrv')) {
    const objectName = fileName.replace(/\.srvd\.srvdsrv$/i, '').toUpperCase();
    const body = [
      '   <SRVD>',
      tag('NAME', objectName),
      tag('TYPE', 'SRVD/SRV'),
      tag('DESCRIPTION', 'Gestion commerciale master data service'),
      tag('LANGUAGE', 'EN'),
      tag('MASTER_LANGUAGE', 'EN'),
      tag('SOURCE_TYPE', 'ABAP_SOURCE'),
      tag('SOURCE_ORIGIN_DESCRIPTION', 'ABAP Development Tools'),
      tag('SRVD_SOURCE_TYPE', 'S'),
      tag('SRVD_SOURCE_TYPE_DESC', 'Definition'),
      '   </SRVD>',
    ].join('\n');
    await writeExportFile(path.join('src', fileName.replace(/\.srvd\.srvdsrv$/i, '.srvd.xml')), objectXml('SRVD', body));
    generatedMetadataCount += 1;
  }
}

await writeExportFile('.abapgit.xml', `${xmlHeader}\n<asx:abap xmlns:asx="${asxNamespace}" version="1.0">\n <asx:values>\n  <DATA>\n   <MASTER_LANGUAGE>E</MASTER_LANGUAGE>\n   <STARTING_FOLDER>/src/</STARTING_FOLDER>\n   <FOLDER_LOGIC>FULL</FOLDER_LOGIC>\n  </DATA>\n </asx:values>\n</asx:abap>\n`);
await writeExportFile('src/package.devc.xml', objectXml('DEVC', '   <DEVC>\n    <CTEXT>Gestion commerciale RAP</CTEXT>\n   </DEVC>'));
const exportReadme = [
  '# Export abapGit - Gestion commerciale RAP',
  '',
  "Ce dossier est genere par `node sap-rap/build-abapgit-export.mjs`. Il contient les sources RAP Clients/Produits et leurs metadonnees abapGit. Les sources d'origine restent dans `sap-rap/src`.",
  '',
  '## Import dans ADT',
  '',
  '1. Installe le plug-in abapGit pour ADT depuis `https://eclipse.abapgit.org/updatesite/` dans **Help > Install New Software...**.',
  '2. Dans le plug-in abapGit d\'ADT, clone `https://github.com/khalidh/gestion-commerciale`, branche `main`, dans le package cible, par exemple `ZGC_RAP`. Le fichier `.abapgit.xml` a la racine limite l\'import a `sap-rap/abapgit-export/src`.',
  '3. Examine les objets proposes et importe-les. Active-les ensuite dans ADT en resolvant les diagnostics du tenant.',
  '',
  '## A creer encore dans SAP',
  '',
  '- L\'objet d\'autorisation `ZGC_MDATA` et ses attributions IAM.',
  '- Le binding `ZUI_GC_MASTER_O4` (OData V4 - UI) pour `ZUI_GC_MASTER`.',
  '- Les index secondaires uniques `Z01` sur `ZGC_RAP_CUST(CLIENT, CUSTOMER_CODE)` et `ZGC_RAP_PROD(CLIENT, PRODUCT_CODE)`.',
  '',
  'Le binding, les autorisations et les index ne sont pas dans les sources disponibles. La compilation, l\'activation et ABAP Unit doivent etre verifies sur le vrai tenant BTP; la generation locale ne les valide.',
  '',
].join('\n');
await writeExportFile('README.md', exportReadme);

assert.equal(generatedTableCount, 4, 'Expected four RAP database tables');
assert.equal(generatedMetadataCount, 14, 'Expected metadata for classes, BDEFs, CDS, DDLX, and SRVD');
console.log(`Generated ${generatedTableCount} table definitions and ${generatedMetadataCount} object metadata files in ${exportDirectory}`);