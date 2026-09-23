/*************************************************
 * SIGURE
 * Sistema Integral de Gestión de Unidades
 * de Respuesta a Emergencias
 *
 * MÓDULO: STOCK
 * Archivo: public/js/stock.js
 *
 * Funciones:
 * - Carga manual masiva
 * - Importación XLSX
 * - Importación XLS
 * - Importación CSV
 * - Validación automática
 * - Vista previa
 * - Registro mediante bulkAddStock
 *************************************************/


// =========================================================
// ESTADO DEL MÓDULO
// =========================================================

const stockModule = {

  unitId: null,

  unit: null,

  stock: [],

  catalog: [],

  mode: 'import',

  importFileName: '',

  importRows: [],

  importValidRows: [],

  importErrors: [],

  importWarnings: []

};


// =========================================================
// ABRIR CARGA MASIVA
// =========================================================

async function openBulkStockModal(unitId) {

  if (!unitId) {

    showToast(
      'No se pudo identificar la unidad.'
    );

    return;
  }


  stockModule.unitId = unitId;

  stockModule.unit = {};

  stockModule.stock = [];

  stockModule.catalog = [];

  resetStockImport();


  try {

    openModal(`
      <div class="modal-section">

        <h2>
          Carga masiva de stock
        </h2>

        <p class="muted">
          Cargando información de la unidad...
        </p>

      </div>
    `);


    const [
      unit,
      stock,
      catalog
    ] = await Promise.all([

      apiCall(
        'getUnit',
        [
          state.token,
          unitId
        ]
      ),

      apiCall(
        'getUnitStock',
        [
          state.token,
          unitId
        ]
      ),

      apiCall(
        'listCatalog',
        [
          state.token
        ]
      )

    ]);


    stockModule.unit =
      unit || {};


    stockModule.stock =
      Array.isArray(stock)
        ? stock
        : [];


    stockModule.catalog =
      Array.isArray(catalog)
        ? catalog
        : [];


    renderBulkStockModal();


  } catch (error) {

    console.error(error);

    closeModal();

    showToast(
      error.message ||
      'No se pudo cargar la información de stock.'
    );

  }

}


// =========================================================
// REINICIAR IMPORTACIÓN
// =========================================================

function resetStockImport() {

  stockModule.importFileName = '';

  stockModule.importRows = [];

  stockModule.importValidRows = [];

  stockModule.importErrors = [];

  stockModule.importWarnings = [];

}


// =========================================================
// STOCK ACTUAL
// =========================================================

function getBulkCurrentStock(itemId) {

  return stockModule.stock
    .filter(
      row =>
        String(row.idInsumo) ===
        String(itemId)
    )
    .reduce(
      (total, row) =>
        total +
        Number(row.cantidad || 0),
      0
    );

}


// =========================================================
// NORMALIZAR CATÁLOGO
// =========================================================

function getBulkCatalogItems() {

  return stockModule.catalog

    .filter(
      item =>
        item &&
        item.idInsumo
    )

    .map(
      item => ({

        idInsumo:
          item.idInsumo,

        codigo:
          String(
            item.codigo ||
            item.codigoInsumo ||
            ''
          ).trim(),

        nombre:
          item.nombre ||
          item.nombreInsumo ||
          item.insumo ||
          item.codigo ||
          'Insumo',

        activo:
          item.activo

      })
    )

    .filter(
      item =>
        item.activo === undefined ||
        item.activo === null ||
        item.activo === '' ||
        asBool(item.activo)
    )

    .sort(
      (a, b) =>
        String(a.nombre)
          .localeCompare(
            String(b.nombre),
            'es'
          )
    );

}


// =========================================================
// NOMBRE DE UNIDAD
// =========================================================

function getBulkUnitName() {

  return (
    stockModule.unit.nombre ||
    stockModule.unit.nombreUnidad ||
    stockModule.unit.codigo ||
    stockModule.unit.idUnidad ||
    'Unidad'
  );

}


// =========================================================
// RENDER PRINCIPAL
// =========================================================

function renderBulkStockModal() {

  const unitName =
    getBulkUnitName();


  openModal(`

    <div class="modal-section">

      <div class="section-title">

        <div>

          <h2>
            Carga masiva de stock
          </h2>

          <p class="muted">
            ${esc(unitName)}
          </p>

        </div>

      </div>


      <div
        style="
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          margin:18px 0;
        "
      >

        <button
          type="button"
          class="btn ${
            stockModule.mode === 'import'
              ? 'primary'
              : 'secondary'
          }"
          id="bulkImportModeButton"
        >
          Importar Excel / CSV
        </button>


        <button
          type="button"
          class="btn ${
            stockModule.mode === 'manual'
              ? 'primary'
              : 'secondary'
          }"
          id="bulkManualModeButton"
        >
          Carga manual
        </button>

      </div>


      <div id="bulkStockModeContent">

        ${
          stockModule.mode === 'import'
            ? renderStockImportView()
            : renderManualStockView()
        }

      </div>

    </div>

  `);


  bindBulkStockEvents();

}


// =========================================================
// VISTA IMPORTACIÓN
// =========================================================

function renderStockImportView() {

  return `

    <div>

      <div
        style="
          border:2px dashed #cbd5e1;
          border-radius:12px;
          padding:24px;
          text-align:center;
          margin-bottom:18px;
          background:#f8fafc;
        "
      >

        <h3 style="margin-top:0">
          Importar archivo de stock
        </h3>


        <p class="muted">
          Seleccione un archivo Excel o CSV.
        </p>


        <p class="muted">
          Formatos admitidos:
          .xlsx, .xls y .csv
        </p>


        <input
          id="bulkStockFile"
          type="file"
          accept=".xlsx,.xls,.csv"
          style="margin:14px 0"
        >


        <div
          style="
            margin-top:10px;
            font-size:13px;
          "
        >
          Columnas esperadas:
          <strong>Código de insumo</strong>,
          <strong>Cantidad</strong>,
          Lote y Vencimiento.
        </div>

      </div>


      ${
        stockModule.importFileName
          ? `
              <div
                style="
                  padding:12px;
                  border:1px solid #e2e8f0;
                  border-radius:10px;
                  margin-bottom:16px;
                "
              >

                <strong>
                  Archivo:
                </strong>

                ${esc(stockModule.importFileName)}

              </div>
            `
          : ''
      }


      ${renderImportSummary()}


      ${renderImportPreview()}


      <div
        style="
          display:flex;
          justify-content:flex-end;
          gap:10px;
          margin-top:20px;
          flex-wrap:wrap;
        "
      >

        <button
          type="button"
          class="btn secondary"
          id="cancelBulkStockButton"
        >
          Cancelar
        </button>


        ${
          stockModule.importRows.length
            ? `
                <button
                  type="button"
                  class="btn secondary"
                  id="clearBulkImportButton"
                >
                  Limpiar archivo
                </button>
              `
            : ''
        }


        ${
          stockModule.importValidRows.length
            ? `
                <button
                  type="button"
                  class="btn primary"
                  id="saveImportedStockButton"
                  ${
                    stockModule.importErrors.length
                      ? 'disabled'
                      : ''
                  }
                >
                  Importar ${
                    stockModule.importValidRows.length
                  } registro(s)
                </button>
              `
            : ''
        }

      </div>

    </div>

  `;

}


// =========================================================
// RESUMEN DE IMPORTACIÓN
// =========================================================

function renderImportSummary() {

  if (!stockModule.importRows.length) {
    return '';
  }


  const total =
    stockModule.importRows.length;

  const valid =
    stockModule.importValidRows.length;

  const errors =
    stockModule.importErrors.length;

  const warnings =
    stockModule.importWarnings.length;


  return `

    <div
      style="
        display:grid;
        grid-template-columns:
          repeat(auto-fit,minmax(130px,1fr));
        gap:10px;
        margin-bottom:18px;
      "
    >

      ${renderImportStat(
        'Filas',
        total
      )}

      ${renderImportStat(
        'Válidas',
        valid
      )}

      ${renderImportStat(
        'Observaciones',
        warnings
      )}

      ${renderImportStat(
        'Errores',
        errors
      )}

    </div>

  `;

}


function renderImportStat(label, value) {

  return `

    <div
      style="
        border:1px solid #e2e8f0;
        border-radius:10px;
        padding:12px;
        background:#fff;
      "
    >

      <div class="muted">
        ${esc(label)}
      </div>

      <strong
        style="
          font-size:22px;
          display:block;
          margin-top:4px;
        "
      >
        ${esc(value)}
      </strong>

    </div>

  `;

}


// =========================================================
// VISTA PREVIA
// =========================================================

function renderImportPreview() {

  if (!stockModule.importRows.length) {
    return '';
  }


  return `

    <div class="table-wrap">

      <table>

        <thead>

          <tr>

            <th>
              Fila
            </th>

            <th>
              Código
            </th>

            <th>
              Insumo
            </th>

            <th>
              Cantidad
            </th>

            <th>
              Lote
            </th>

            <th>
              Vencimiento
            </th>

            <th>
              Validación
            </th>

          </tr>

        </thead>


        <tbody>

          ${
            stockModule.importRows
              .map(
                renderImportPreviewRow
              )
              .join('')
          }

        </tbody>

      </table>

    </div>

  `;

}


function renderImportPreviewRow(row) {

  let statusText =
    'Válido';


  if (row.errors.length) {

    statusText =
      row.errors.join(' · ');

  } else if (row.warnings.length) {

    statusText =
      row.warnings.join(' · ');

  }


  return `

    <tr>

      <td>
        ${esc(row.rowNumber)}
      </td>

      <td>
        ${esc(row.codigo)}
      </td>

      <td>
        ${
          row.item
            ? esc(row.item.nombre)
            : '<span class="muted">No identificado</span>'
        }
      </td>

      <td>
        ${esc(row.cantidad)}
      </td>

      <td>
        ${esc(row.numeroLote || '—')}
      </td>

      <td>
        ${esc(row.fechaVencimiento || '—')}
      </td>

      <td>

        ${
          row.errors.length
            ? `<strong>ERROR:</strong> ${esc(statusText)}`
            : row.warnings.length
              ? `<strong>OBSERVACIÓN:</strong> ${esc(statusText)}`
              : '<strong>OK</strong>'
        }

      </td>

    </tr>

  `;

}


// =========================================================
// VISTA MANUAL
// =========================================================

function renderManualStockView() {

  const items =
    getBulkCatalogItems();


  return `

    <div
      class="form-group"
      style="margin-bottom:18px"
    >

      <label for="bulkStockSearch">
        Buscar insumo
      </label>

      <input
        id="bulkStockSearch"
        type="search"
        placeholder="Buscar por nombre o código..."
        autocomplete="off"
      >

    </div>


    <div class="table-wrap">

      <table>

        <thead>

          <tr>

            <th>
              Insumo
            </th>

            <th>
              Stock actual
            </th>

            <th>
              Cantidad a ingresar
            </th>

            <th>
              N.º de lote
            </th>

            <th>
              Vencimiento
            </th>

          </tr>

        </thead>


        <tbody id="bulkStockRows">

          ${
            items.length

              ? items
                  .map(
                    renderBulkStockRow
                  )
                  .join('')

              : `
                  <tr>

                    <td
                      colspan="5"
                      class="muted"
                    >
                      No hay insumos disponibles
                      en el catálogo.
                    </td>

                  </tr>
                `
          }

        </tbody>

      </table>

    </div>


    <div
      style="
        display:flex;
        justify-content:flex-end;
        gap:10px;
        margin-top:20px;
      "
    >

      <button
        type="button"
        class="btn secondary"
        id="cancelBulkStockButton"
      >
        Cancelar
      </button>


      <button
        type="button"
        class="btn primary"
        id="saveBulkStockButton"
      >
        Registrar carga
      </button>

    </div>

  `;

}


// =========================================================
// FILA MANUAL
// =========================================================

function renderBulkStockRow(item) {

  const current =
    getBulkCurrentStock(
      item.idInsumo
    );


  const searchText =
    (
      String(item.codigo || '') +
      ' ' +
      String(item.nombre || '')
    )
      .toLowerCase();


  return `

    <tr
      class="bulk-stock-row"
      data-search="${esc(searchText)}"
      data-item-id="${esc(item.idInsumo)}"
    >

      <td>

        <strong>
          ${esc(item.nombre)}
        </strong>

        ${
          item.codigo
            ? `
                <div class="muted">
                  ${esc(item.codigo)}
                </div>
              `
            : ''
        }

      </td>


      <td>
        ${esc(current)}
      </td>


      <td>

        <input
          type="number"
          class="bulk-stock-qty"
          min="0"
          step="1"
          value="0"
          inputmode="numeric"
          style="min-width:110px"
        >

      </td>


      <td>

        <input
          type="text"
          class="bulk-stock-lot"
          maxlength="100"
          placeholder="Lote"
          autocomplete="off"
          style="min-width:140px"
        >

      </td>


      <td>

        <input
          type="date"
          class="bulk-stock-expiry"
          style="min-width:145px"
        >

      </td>

    </tr>

  `;

}


// =========================================================
// EVENTOS
// =========================================================

function bindBulkStockEvents() {

  $('#bulkImportModeButton')
    ?.addEventListener(
      'click',
      function () {

        stockModule.mode = 'import';

        renderBulkStockModal();

      }
    );


  $('#bulkManualModeButton')
    ?.addEventListener(
      'click',
      function () {

        stockModule.mode = 'manual';

        renderBulkStockModal();

      }
    );


  $('#cancelBulkStockButton')
    ?.addEventListener(
      'click',
      closeModal
    );


  $('#saveBulkStockButton')
    ?.addEventListener(
      'click',
      saveBulkStock
    );


  $('#bulkStockSearch')
    ?.addEventListener(
      'input',
      filterBulkStockRows
    );


  $('#bulkStockFile')
    ?.addEventListener(
      'change',
      handleStockImportFile
    );


  $('#clearBulkImportButton')
    ?.addEventListener(
      'click',
      function () {

        resetStockImport();

        renderBulkStockModal();

      }
    );


  $('#saveImportedStockButton')
    ?.addEventListener(
      'click',
      saveImportedStock
    );

}


// =========================================================
// BUSCADOR MANUAL
// =========================================================

function filterBulkStockRows() {

  const search =

    String(
      $('#bulkStockSearch')?.value || ''
    )
      .trim()
      .toLowerCase();


  $$('.bulk-stock-row')
    .forEach(
      row => {

        const text =
          String(
            row.dataset.search || ''
          );


        row.style.display =

          !search ||
          text.includes(search)

            ? ''

            : 'none';

      }
    );

}


// =========================================================
// OBTENER DATOS MANUALES
// =========================================================

function collectBulkStockDetails() {

  const details = [];


  $$('.bulk-stock-row')
    .forEach(
      row => {

        const quantity =

          Number(
            row.querySelector(
              '.bulk-stock-qty'
            )?.value || 0
          );


        if (quantity <= 0) {
          return;
        }


        const itemId =
          row.dataset.itemId;


        const lot =
          String(
            row.querySelector(
              '.bulk-stock-lot'
            )?.value || ''
          ).trim();


        const expiry =
          String(
            row.querySelector(
              '.bulk-stock-expiry'
            )?.value || ''
          ).trim();


        details.push({

          idInsumo:
            itemId,

          cantidad:
            quantity,

          numeroLote:
            lot,

          fechaVencimiento:
            expiry

        });

      }
    );


  return details;

}


// =========================================================
// GUARDAR CARGA MANUAL
// =========================================================

async function saveBulkStock() {

  const button =
    $('#saveBulkStockButton');


  if (!button) {
    return;
  }


  const details =
    collectBulkStockDetails();


  if (!details.length) {

    showToast(
      'Ingrese una cantidad mayor a cero en al menos un insumo.'
    );

    return;
  }


  button.disabled = true;

  button.textContent =
    'Registrando...';


  try {

    const result =

      await apiCall(
        'bulkAddStock',
        [
          state.token,

          {
            idUnidad:
              stockModule.unitId,

            detalles:
              details
          }

        ]
      );


    showToast(
      `Carga registrada correctamente. ${details.length} insumo(s) actualizado(s).`
    );


    await finishStockLoad();


    return result;


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      'No se pudo registrar la carga masiva.'
    );


  } finally {

    button.disabled = false;

    button.textContent =
      'Registrar carga';

  }

}


// =========================================================
// IMPORTACIÓN DE ARCHIVO
// =========================================================

async function handleStockImportFile(event) {

  const input =
    event.target;

  const file =
    input.files &&
    input.files[0];


  if (!file) {
    return;
  }


  resetStockImport();

  stockModule.importFileName =
    file.name;


  try {

    if (
      typeof XLSX === 'undefined'
    ) {

      throw new Error(
        'No se pudo cargar el lector de archivos Excel.'
      );

    }


    const extension =
      String(
        file.name
          .split('.')
          .pop() || ''
      )
        .toLowerCase();


    if (
      ![
        'xlsx',
        'xls',
        'csv'
      ].includes(extension)
    ) {

      throw new Error(
        'Formato no admitido. Utilice XLSX, XLS o CSV.'
      );

    }


    const buffer =
      await file.arrayBuffer();


    const workbook =
      XLSX.read(
        buffer,
        {
          type: 'array',
          cellDates: true
        }
      );


    if (
      !workbook.SheetNames ||
      !workbook.SheetNames.length
    ) {

      throw new Error(
        'El archivo no contiene hojas.'
      );

    }


    const sheetName =
      workbook.SheetNames[0];


    const worksheet =
      workbook.Sheets[
        sheetName
      ];


    const rows =
      XLSX.utils.sheet_to_json(
        worksheet,
        {
          defval: '',
          raw: false
        }
      );


    if (!rows.length) {

      throw new Error(
        'El archivo no contiene registros para importar.'
      );

    }


    processStockImportRows(
      rows
    );


    renderBulkStockModal();


  } catch (error) {

    console.error(error);

    resetStockImport();

    renderBulkStockModal();

    showToast(
      error.message ||
      'No se pudo procesar el archivo.'
    );

  }

}


// =========================================================
// NORMALIZACIÓN DE ENCABEZADOS
// =========================================================

function normalizeImportHeader(value) {

  return String(
    value || ''
  )
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toUpperCase()
    .trim()
    .replace(
      /[^A-Z0-9]+/g,
      '_'
    )
    .replace(
      /^_+|_+$/g,
      ''
    );

}


// =========================================================
// OBTENER VALOR DE COLUMNA
// =========================================================

function getImportValue(
  row,
  acceptedHeaders
) {

  const normalizedRow = {};


  Object.keys(
    row || {}
  )
    .forEach(
      key => {

        normalizedRow[
          normalizeImportHeader(key)
        ] =
          row[key];

      }
    );


  for (
    const header of acceptedHeaders
  ) {

    const normalized =
      normalizeImportHeader(
        header
      );


    if (
      Object.prototype.hasOwnProperty.call(
        normalizedRow,
        normalized
      )
    ) {

      return normalizedRow[
        normalized
      ];

    }

  }


  return '';

}


// =========================================================
// PROCESAR FILAS IMPORTADAS
// =========================================================

function processStockImportRows(rows) {

  const catalog =
    getBulkCatalogItems();


  const catalogByCode =
    new Map();


  catalog.forEach(
    item => {

      const code =
        normalizeImportCode(
          item.codigo
        );


      if (code) {

        catalogByCode.set(
          code,
          item
        );

      }

    }
  );


  const processed = [];


  rows.forEach(
    (sourceRow, index) => {

      const codigo =
        String(
          getImportValue(
            sourceRow,
            [
              'CODIGO_INSUMO',
              'CODIGO',
              'CÓDIGO',
              'CODIGO INSUMO',
              'CÓDIGO INSUMO',
              'CODIGO DE INSUMO',
              'CÓDIGO DE INSUMO'
            ]
          ) || ''
        ).trim();


      const quantityValue =
        getImportValue(
          sourceRow,
          [
            'CANTIDAD',
            'CANTIDAD_INGRESAR',
            'CANTIDAD A INGRESAR',
            'CANT',
            'QTY'
          ]
        );


      const lot =
        String(
          getImportValue(
            sourceRow,
            [
              'NUMERO_LOTE',
              'NÚMERO_LOTE',
              'NUMERO DE LOTE',
              'NÚMERO DE LOTE',
              'LOTE',
              'NRO_LOTE',
              'NRO LOTE'
            ]
          ) || ''
        ).trim();


      const expiryRaw =
        getImportValue(
          sourceRow,
          [
            'FECHA_VENCIMIENTO',
            'FECHA DE VENCIMIENTO',
            'VENCIMIENTO',
            'FECHA_VTO',
            'VTO'
          ]
        );


      const cantidad =
        parseImportQuantity(
          quantityValue
        );


      const fechaVencimiento =
        normalizeImportDate(
          expiryRaw
        );


      const item =
        catalogByCode.get(
          normalizeImportCode(
            codigo
          )
        ) || null;


      const errors = [];

      const warnings = [];


      if (!codigo) {

        errors.push(
          'Código de insumo vacío'
        );

      } else if (!item) {

        errors.push(
          'Código inexistente en el catálogo'
        );

      }


      if (
        !Number.isFinite(cantidad) ||
        cantidad <= 0
      ) {

        errors.push(
          'Cantidad inválida'
        );

      }


      if (
        expiryRaw &&
        !fechaVencimiento
      ) {

        errors.push(
          'Fecha de vencimiento inválida'
        );

      }


      if (!lot) {

        warnings.push(
          'Sin número de lote'
        );

      }


      if (!fechaVencimiento) {

        warnings.push(
          'Sin fecha de vencimiento'
        );

      }


      processed.push({

        rowNumber:
          index + 2,

        codigo:
          codigo,

        cantidad:
          Number.isFinite(cantidad)
            ? cantidad
            : '',

        numeroLote:
          lot,

        fechaVencimiento:
          fechaVencimiento,

        item:
          item,

        errors:
          errors,

        warnings:
          warnings

      });

    }
  );


  stockModule.importRows =
    processed;


  stockModule.importValidRows =
    processed.filter(
      row =>
        !row.errors.length
    );


  stockModule.importErrors =
    processed.filter(
      row =>
        row.errors.length
    );


  stockModule.importWarnings =
    processed.filter(
      row =>
        !row.errors.length &&
        row.warnings.length
    );

}


// =========================================================
// NORMALIZAR CÓDIGO
// =========================================================

function normalizeImportCode(value) {

  let code =
    String(
      value === undefined ||
      value === null
        ? ''
        : value
    )
      .trim();


  // Excel puede convertir códigos numéricos a "295.0".
  if (
    /^[0-9]+\.0+$/.test(code)
  ) {

    code =
      code.split('.')[0];

  }


  return code
    .toUpperCase();

}


// =========================================================
// NORMALIZAR CANTIDAD
// =========================================================

function parseImportQuantity(value) {

  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {

    return NaN;

  }


  if (
    typeof value === 'number'
  ) {

    return value;

  }


  let text =
    String(value)
      .trim()
      .replace(/\s/g, '');


  if (!text) {
    return NaN;
  }


  // Admite decimal con coma.
  if (
    text.includes(',') &&
    !text.includes('.')
  ) {

    text =
      text.replace(',', '.');

  }


  const number =
    Number(text);


  return number;

}


// =========================================================
// NORMALIZAR FECHA
// =========================================================

function normalizeImportDate(value) {

  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {

    return '';

  }


  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {

    return formatImportDate(
      value
    );

  }


  const text =
    String(value)
      .trim();


  if (!text) {
    return '';
  }


  // YYYY-MM-DD
  let match =
    text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );


  if (match) {

    return validateAndFormatImportDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );

  }


  // DD/MM/YYYY o DD-MM-YYYY
  match =
    text.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
    );


  if (match) {

    return validateAndFormatImportDate(
      Number(match[3]),
      Number(match[2]),
      Number(match[1])
    );

  }


  // Algunos formatos devueltos por SheetJS:
  // M/D/YY o M/D/YYYY
  match =
    text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/
    );


  if (match) {

    let year =
      Number(match[3]);


    if (year < 100) {

      year +=
        year >= 70
          ? 1900
          : 2000;

    }


    return validateAndFormatImportDate(
      year,
      Number(match[1]),
      Number(match[2])
    );

  }


  const parsed =
    new Date(text);


  if (
    !Number.isNaN(
      parsed.getTime()
    )
  ) {

    return formatImportDate(
      parsed
    );

  }


  return '';

}


function validateAndFormatImportDate(
  year,
  month,
  day
) {

  const date =
    new Date(
      year,
      month - 1,
      day
    );


  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {

    return '';

  }


  return formatImportDate(
    date
  );

}


function formatImportDate(date) {

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );


  return `${year}-${month}-${day}`;

}


// =========================================================
// GUARDAR IMPORTACIÓN
// =========================================================

async function saveImportedStock() {

  const button =
    $('#saveImportedStockButton');


  if (!button) {
    return;
  }


  if (
    stockModule.importErrors.length
  ) {

    showToast(
      'El archivo contiene errores. Corríjalos antes de importar.'
    );

    return;
  }


  const details =
    stockModule.importValidRows
      .map(
        row => ({

          idInsumo:
            row.item.idInsumo,

          cantidad:
            row.cantidad,

          numeroLote:
            row.numeroLote,

          fechaVencimiento:
            row.fechaVencimiento

        })
      );


  if (!details.length) {

    showToast(
      'No existen registros válidos para importar.'
    );

    return;
  }


  button.disabled = true;

  button.textContent =
    'Importando...';


  try {

    const result =

      await apiCall(
        'bulkAddStock',
        [
          state.token,

          {
            idUnidad:
              stockModule.unitId,

            detalles:
              details
          }

        ]
      );


    showToast(
      `Importación completada. ${details.length} registro(s) incorporado(s) al stock.`
    );


    await finishStockLoad();


    return result;


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      'No se pudo importar el archivo.'
    );


  } finally {

    button.disabled = false;

    button.textContent =
      `Importar ${details.length} registro(s)`;

  }

}


// =========================================================
// FINALIZAR CARGA
// =========================================================

async function finishStockLoad() {

  closeModal();


  if (
    typeof openUnit ===
    'function'
  ) {

    await openUnit(
      stockModule.unitId
    );

  } else {

    await renderView(
      'units'
    );

  }

}
