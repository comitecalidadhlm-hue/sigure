/*************************************************
 * SIGURE
 * Sistema Integral de Gestión de Unidades
 * de Respuesta a Emergencias
 *
 * MÓDULO: STOCK
 * Archivo: public/js/stock.js
 *************************************************/


// =========================================================
// ESTADO DEL MÓDULO
// =========================================================

const stockModule = {

  unitId: null,

  unit: null,

  stock: [],

  catalog: []

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


  stockModule.unitId =
    unitId;


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


    // -----------------------------------------------------
    // OBTENER UNIDAD + STOCK + CATÁLOGO
    // -----------------------------------------------------

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
// CALCULAR STOCK ACTUAL
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
        Number(
          row.cantidad || 0
        ),
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
          item.codigo ||
          item.codigoInsumo ||
          '',

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
// RENDER DEL MODAL
// =========================================================

function renderBulkStockModal() {

  const items =
    getBulkCatalogItems();


  const unitName =

    stockModule.unit.nombre ||

    stockModule.unit.nombreUnidad ||

    stockModule.unit.codigo ||

    stockModule.unit.idUnidad ||

    'Unidad';


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

    </div>

  `);


  bindBulkStockEvents();

}


// =========================================================
// FILA DE INSUMO
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

}


// =========================================================
// BUSCADOR
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
// OBTENER DETALLES INGRESADOS
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


        // -------------------------------------------------
        // CANTIDAD 0 = NO SE ENVÍA
        // -------------------------------------------------

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
// GUARDAR CARGA MASIVA
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


  button.disabled =
    true;


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


    closeModal();


    // -----------------------------------------------------
    // ACTUALIZAR DETALLE DE UNIDAD
    // -----------------------------------------------------

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


    return result;


  } catch (error) {

    console.error(error);


    showToast(
      error.message ||
      'No se pudo registrar la carga masiva.'
    );


  } finally {

    button.disabled =
      false;


    button.textContent =
      'Registrar carga';

  }

}
