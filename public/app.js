/*************************************************
 * SIGURE
 * Sistema Integral de Gestión de Unidades
 * de Respuesta a Emergencias
 *
 * FRONTEND CLOUDFLARE
 * Archivo: public/app.js
 *************************************************/


// =========================================================
// CONFIGURACIÓN FRONTEND
// =========================================================

// Debe coincidir con APP.CONTROL_TYPE del backend.
// Si Apps Script utiliza otro texto para la visoría,
// solamente habrá que modificar esta constante.
const VISORIA_CONTROL_TYPE = 'VISORIA';


// =========================================================
// ESTADO GENERAL
// =========================================================

const state = {
  token: null,
  user: null,
  currentView: 'dashboard',
  adminData: null
};


// =========================================================
// INICIO
// =========================================================

document.addEventListener(
  'DOMContentLoaded',
  function () {
    bindBaseEvents();
    restoreSession();
  }
);


// =========================================================
// UTILIDADES
// =========================================================

function $(selector) {
  return document.querySelector(selector);
}


function $$(selector) {
  return Array.from(
    document.querySelectorAll(selector)
  );
}


function esc(value) {
  return String(value ?? '')
    .replace(
      /[&<>"']/g,
      function (character) {
        const map = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        };

        return map[character];
      }
    );
}


function fmtDate(value) {
  if (!value) {
    return '-';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleString(
    'es-AR'
  );
}


function fmtDateInput(value) {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  return date
    .toISOString()
    .slice(0, 10);
}


function asBool(value) {
  return (
    value === true ||
    String(value)
      .toLowerCase() ===
      'true' ||
    String(value)
      .toUpperCase() ===
      'VERDADERO'
  );
}


function numberValue(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}


function statusBadge(status) {
  const normalized =
    String(status || '')
      .toUpperCase();

  let css =
    'warn';

  if (
    [
      'OPERATIVA',
      'OPERATIVO',
      'ACTIVO',
      'ACTIVA',
      'ABIERTO',
      'ABIERTA',
      'CONFORME'
    ].includes(normalized)
  ) {
    css =
      'ok';
  }

  if (
    [
      'NO_OPERATIVA',
      'FUERA_DE_SERVICIO',
      'INACTIVO',
      'INACTIVA',
      'CERRADO',
      'CERRADA',
      'NO_CONFORME',
      'CRITICO',
      'CRÍTICO'
    ].includes(normalized)
  ) {
    css =
      'danger';
  }

  if (
    normalized ===
      'EN_REPOSICION' ||
    normalized ===
      'EN REPOSICIÓN'
  ) {
    css =
      'info';
  }

  return `
    <span class="status ${css}">
      ${esc(status || '-')}
    </span>
  `;
}


function showToast(message) {
  const container =
    $('#toast');

  if (!container) {
    alert(message);
    return;
  }

  const toast =
    document.createElement(
      'div'
    );

  toast.className =
    'toast';

  toast.textContent =
    message;

  container.appendChild(
    toast
  );

  setTimeout(
    function () {
      toast.remove();
    },
    3500
  );
}


function showLoginMessage(message) {
  const element =
    $('#loginMessage');

  if (!element) {
    return;
  }

  if (!message) {
    element.classList.add(
      'hidden'
    );

    element.textContent =
      '';

    return;
  }

  element.textContent =
    message;

  element.classList.remove(
    'hidden'
  );
}


function openModal(html) {
  const modal =
    $('#modal');

  const body =
    $('#modalBody');

  if (
    !modal ||
    !body
  ) {
    return;
  }

  body.innerHTML =
    html;

  modal.classList.remove(
    'hidden'
  );
}


function closeModal() {
  const modal =
    $('#modal');

  const body =
    $('#modalBody');

  if (modal) {
    modal.classList.add(
      'hidden'
    );
  }

  if (body) {
    body.innerHTML =
      '';
  }
}


function extractArray(
  response,
  possibleKeys = []
) {
  if (
    Array.isArray(response)
  ) {
    return response;
  }

  if (!response) {
    return [];
  }

  for (
    const key of possibleKeys
  ) {
    if (
      Array.isArray(
        response[key]
      )
    ) {
      return response[key];
    }
  }

  return [];
}


// =========================================================
// NORMALIZACIÓN DE INSUMOS
// =========================================================

function normalizeStockItem(item) {
  return {
    idInsumo:
      item.idInsumo ||
      item.insumoId ||
      '',

    codigo:
      item.codigo ||
      item.codigoInsumo ||
      '',

    nombre:
      item.nombreInsumo ||
      item.insumo ||
      item.nombre ||
      item.codigoInsumo ||
      'Insumo',

    cantidadActual:
      numberValue(
        item.cantidadActual ??
        item.cantidad ??
        item.stock ??
        0
      ),

    cantidadEsperada:
      numberValue(
        item.cantidadRequerida ??
        item.cantidadEsperada ??
        item.stockEsperado ??
        0
      ),

    cantidadMinima:
      numberValue(
        item.cantidadMinima ??
        0
      ),

    idLote:
      item.idLote ||
      '',

    numeroLote:
      item.numeroLote ||
      item.lote ||
      '',

    fechaVencimiento:
      item.fechaVencimiento ||
      item.vencimiento ||
      ''
  };
}


function normalizeTemplateItem(item) {
  return {
    idInsumo:
      item.idInsumo ||
      '',

    codigo:
      item.codigo ||
      item.codigoInsumo ||
      '',

    nombre:
      item.nombreInsumo ||
      item.nombre ||
      item.insumo ||
      item.codigo ||
      'Insumo',

    cantidadEsperada:
      numberValue(
        item.cantidadRequerida ??
        item.cantidadEsperada ??
        0
      ),

    cantidadMinima:
      numberValue(
        item.cantidadMinima ??
        0
      ),

    compartimiento:
      item.compartimiento ||
      '',

    esCritico:
      asBool(
        item.esCritico
      )
  };
}


function mergeTemplateAndStock(
  stock,
  templateItems
) {
  const map =
    new Map();

  templateItems.forEach(
    function (item) {
      const normalized =
        normalizeTemplateItem(
          item
        );

      if (
        normalized.idInsumo
      ) {
        map.set(
          normalized.idInsumo,
          {
            ...normalized,
            cantidadActual: 0,
            idLote: '',
            numeroLote: '',
            fechaVencimiento: ''
          }
        );
      }
    }
  );

  stock.forEach(
    function (item) {
      const normalized =
        normalizeStockItem(
          item
        );

      if (
        normalized.idInsumo &&
        map.has(
          normalized.idInsumo
        )
      ) {
        const previous =
          map.get(
            normalized.idInsumo
          );

        map.set(
          normalized.idInsumo,
          {
            ...previous,
            ...normalized,

            cantidadEsperada:
              previous.cantidadEsperada ||
              normalized.cantidadEsperada
          }
        );

      } else if (
        normalized.idInsumo
      ) {
        map.set(
          normalized.idInsumo,
          normalized
        );
      }
    }
  );

  return Array.from(
    map.values()
  );
}


// =========================================================
// API
// =========================================================

async function apiCall(
  action,
  args = []
) {
  const response =
    await fetch(
      '/api',
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body:
          JSON.stringify({
            action:
              action,

            args:
              Array.isArray(args)
                ? args
                : []
          })
      }
    );

  let payload;

  try {
    payload =
      await response.json();

  } catch (error) {
    throw new Error(
      'La API de SIGURE devolvió una respuesta inválida.'
    );
  }

  if (!response.ok) {
    throw new Error(
      payload.error ||
      `Error HTTP ${response.status}`
    );
  }

  if (
    payload.ok !== true
  ) {
    throw new Error(
      payload.error ||
      'Error de comunicación con SIGURE.'
    );
  }

  const apiResult =
    payload.result;

  if (!apiResult) {
    throw new Error(
      'SIGURE no devolvió resultado.'
    );
  }

  if (
    apiResult.ok !== true
  ) {
    throw new Error(
      apiResult.error ||
      'La operación no pudo completarse.'
    );
  }

  return apiResult.data;
}


// =========================================================
// EVENTOS BASE
// =========================================================

function bindBaseEvents() {
  $('#loginForm')
    ?.addEventListener(
      'submit',
      onLogin
    );


  $('#togglePassword')
    ?.addEventListener(
      'click',
      function () {
        const input =
          $('#loginPass');

        if (!input) {
          return;
        }

        input.type =
          input.type ===
          'password'
            ? 'text'
            : 'password';

        this.textContent =
          input.type ===
          'password'
            ? 'Ver'
            : 'Ocultar';
      }
    );


  $('#logoutButton')
    ?.addEventListener(
      'click',
      onLogout
    );


  $('#refreshButton')
    ?.addEventListener(
      'click',
      function () {
        renderView(
          state.currentView
        );
      }
    );


  $('#mobileMenuButton')
    ?.addEventListener(
      'click',
      function () {
        $('.sidebar')
          ?.classList
          .toggle(
            'open'
          );
      }
    );


  $('#modalClose')
    ?.addEventListener(
      'click',
      closeModal
    );


  $('[data-close-modal="true"]')
    ?.addEventListener(
      'click',
      closeModal
    );


  $$('#nav [data-view]')
    .forEach(
      function (button) {
        button.addEventListener(
          'click',
          function () {
            $('.sidebar')
              ?.classList
              .remove(
                'open'
              );

            renderView(
              button.dataset.view
            );
          }
        );
      }
    );
}


// =========================================================
// LOGIN
// =========================================================

async function onLogin(event) {
  event.preventDefault();

  showLoginMessage('');

  const button =
    $('#loginButton');

  const userInput =
    $('#loginUser');

  const passwordInput =
    $('#loginPass');

  if (
    !button ||
    !userInput ||
    !passwordInput
  ) {
    showLoginMessage(
      'No se pudo inicializar el formulario.'
    );

    return;
  }

  const usuario =
    userInput.value.trim();

  const password =
    passwordInput.value;

  if (
    !usuario ||
    !password
  ) {
    showLoginMessage(
      'Ingrese usuario y contraseña.'
    );

    return;
  }

  button.disabled =
    true;

  button.textContent =
    'Ingresando...';

  try {
    const result =
      await apiCall(
        'login',
        [
          usuario,
          password
        ]
      );

    if (
      !result ||
      !result.token ||
      !result.user
    ) {
      throw new Error(
        'La sesión recibida desde SIGURE es inválida.'
      );
    }

    state.token =
      result.token;

    state.user =
      result.user;

    saveSession();

    enterApp();

    await renderView(
      'dashboard'
    );

  } catch (error) {
    showLoginMessage(
      error.message
    );

  } finally {
    button.disabled =
      false;

    button.textContent =
      'Ingresar a SIGURE';
  }
}


// =========================================================
// LOGOUT
// =========================================================

async function onLogout() {
  try {
    if (
      state.token
    ) {
      await apiCall(
        'logout',
        [
          state.token
        ]
      );
    }

  } catch (error) {
    console.warn(
      error
    );
  }

  clearSession();

  window.location.reload();
}


// =========================================================
// SESIÓN
// =========================================================

function saveSession() {
  sessionStorage.setItem(
    'sigure_token',
    state.token
  );

  sessionStorage.setItem(
    'sigure_user',
    JSON.stringify(
      state.user
    )
  );
}


function clearSession() {
  state.token =
    null;

  state.user =
    null;

  state.adminData =
    null;

  sessionStorage.removeItem(
    'sigure_token'
  );

  sessionStorage.removeItem(
    'sigure_user'
  );
}


async function restoreSession() {
  const token =
    sessionStorage.getItem(
      'sigure_token'
    );

  const rawUser =
    sessionStorage.getItem(
      'sigure_user'
    );

  if (
    !token ||
    !rawUser
  ) {
    showLogin();
    return;
  }

  try {
    state.token =
      token;

    state.user =
      JSON.parse(
        rawUser
      );

    await apiCall(
      'getDashboard',
      [
        state.token
      ]
    );

    enterApp();

    await renderView(
      'dashboard'
    );

  } catch (error) {
    clearSession();
    showLogin();
  }
}


function showLogin() {
  $('#appView')
    ?.classList
    .add(
      'hidden'
    );

  $('#loginView')
    ?.classList
    .remove(
      'hidden'
    );
}


function enterApp() {
  $('#loginView')
    ?.classList
    .add(
      'hidden'
    );

  $('#appView')
    ?.classList
    .remove(
      'hidden'
    );

  if (
    !state.user
  ) {
    return;
  }

  if (
    $('#sessionName')
  ) {
    $('#sessionName')
      .textContent =
        state.user.nombre ||
        state.user.usuario ||
        'Usuario';
  }

  if (
    $('#sidebarRole')
  ) {
    $('#sidebarRole')
      .textContent =
        state.user.rol ===
        'CALIDAD'
          ? 'Administración institucional'
          : 'Gestión del servicio';
  }

  if (
    $('#sessionService')
  ) {
    $('#sessionService')
      .textContent =
        state.user.rol ===
        'CALIDAD'
          ? 'Área de Calidad'
          : 'Usuario de servicio';
  }

  $$('.admin-only')
    .forEach(
      function (element) {
        element.classList.toggle(
          'hidden',
          state.user.rol !==
            'CALIDAD'
        );
      }
    );
}


// =========================================================
// NAVEGACIÓN
// =========================================================

async function renderView(view) {
  if (
    view ===
      'admin' &&
    state.user?.rol !==
      'CALIDAD'
  ) {
    view =
      'dashboard';
  }

  state.currentView =
    view;

  $$('#nav [data-view]')
    .forEach(
      function (button) {
        button.classList.toggle(
          'active',
          button.dataset.view ===
            view
        );
      }
    );

  const titles = {
    dashboard: [
      'Panel',
      'Resumen operativo de SIGURE'
    ],

    units: [
      'Unidades',
      'Carros, mochilas y botiquines asignados'
    ],

    alerts: [
      'Alertas',
      'Situaciones que requieren atención'
    ],

    feedback: [
      'Auditorías / Feedback',
      'Devoluciones y seguimiento de Calidad'
    ],

    admin: [
      'Administración',
      'Configuración institucional'
    ]
  };

  const safeTitle =
    titles[view] ||
    titles.dashboard;

  $('#viewTitle')
    .textContent =
      safeTitle[0];

  $('#viewSubtitle')
    .textContent =
      safeTitle[1];

  $('#content')
    .innerHTML =
      '<div class="loading-card">Cargando información...</div>';

  try {
    if (
      view ===
      'dashboard'
    ) {
      return await renderDashboard();
    }

    if (
      view ===
      'units'
    ) {
      return await renderUnits();
    }

    if (
      view ===
      'alerts'
    ) {
      return await renderAlerts();
    }

    if (
      view ===
      'feedback'
    ) {
      return await renderFeedback();
    }

    if (
      view ===
      'admin'
    ) {
      return await renderAdmin();
    }

  } catch (error) {
    $('#content')
      .innerHTML = `
        <div class="empty-state">

          <strong>
            No se pudo cargar la información.
          </strong>

          <p class="muted">
            ${esc(error.message)}
          </p>

        </div>
      `;
  }
}


// =========================================================
// DASHBOARD
// =========================================================

function metricCard(
  label,
  value
) {
  return `
    <div class="card">

      <div class="metric-label">
        ${esc(label)}
      </div>

      <div class="metric-value">
        ${esc(value)}
      </div>

    </div>
  `;
}


async function renderDashboard() {
  const dashboard =
    await apiCall(
      'getDashboard',
      [
        state.token
      ]
    );

  const totals =
    dashboard?.totals ||
    {};

  const byStatus =
    dashboard?.byStatus ||
    {};

  const units =
    Array.isArray(
      dashboard?.units
    )
      ? dashboard.units
      : [];

  const alerts =
    Array.isArray(
      dashboard?.alerts
    )
      ? dashboard.alerts
      : [];

  $('#content')
    .innerHTML = `

      <div class="grid metric-grid">

        ${metricCard(
          'Unidades',
          totals.units || 0
        )}

        ${metricCard(
          'Operativas',
          byStatus.OPERATIVA || 0
        )}

        ${metricCard(
          'En reposición',
          byStatus.EN_REPOSICION || 0
        )}

        ${metricCard(
          'No operativas',
          byStatus.NO_OPERATIVA || 0
        )}

        ${metricCard(
          'Alertas abiertas',
          totals.alerts || 0
        )}

        ${metricCard(
          'Feedback pendiente',
          totals.feedbackPending || 0
        )}

      </div>


      <div class="section-title">
        <h3>
          Estado de unidades
        </h3>
      </div>


      <div class="grid units-grid">

        ${
          units.length
            ? units
                .map(
                  unitCard
                )
                .join('')
            : `
              <div class="empty-state">
                No hay unidades registradas.
              </div>
            `
        }

      </div>


      <div class="section-title">
        <h3>
          Alertas prioritarias
        </h3>
      </div>


      ${alertsTable(alerts)}
    `;

  bindUnitOpenButtons();
}


// =========================================================
// UNIDADES
// =========================================================

async function renderUnits() {
  const units =
    await apiCall(
      'listMyUnits',
      [
        state.token
      ]
    );

  $('#content')
    .innerHTML = `

      <div class="grid units-grid">

        ${
          Array.isArray(units) &&
          units.length
            ? units
                .map(
                  unitCard
                )
                .join('')
            : `
              <div class="empty-state">
                No hay unidades asignadas.
              </div>
            `
        }

      </div>
    `;

  bindUnitOpenButtons();
}


function unitCard(unit) {
  return `
    <article class="card unit-card">

      <div class="unit-head">

        <div>

          <div class="unit-code">
            ${esc(unit.codigo)}
            ·
            ${esc(unit.nombre)}
          </div>

        </div>

        ${statusBadge(
          unit.estado
        )}

      </div>


      <div class="muted">

        ${esc(
          unit.tipoNombre ||
          ''
        )}

        ${
          unit.servicioNombre
            ? ' · ' +
              esc(
                unit.servicioNombre
              )
            : ''
        }

      </div>


      <div>
        ${esc(
          unit.ubicacion ||
          'Sin ubicación informada'
        )}
      </div>


      <div class="muted">

        Próxima acción:

        <strong>
          ${fmtDate(
            unit.proximaAccion
          )}
        </strong>

      </div>


      <div style="margin-top:12px">

        <button
          type="button"
          class="button secondary open-unit"
          data-unit-id="${esc(
            unit.idUnidad
          )}"
        >
          Abrir unidad
        </button>

      </div>

    </article>
  `;
}


// =========================================================
// ABRIR UNIDAD
// =========================================================

function bindUnitOpenButtons() {
  $$('.open-unit')
    .forEach(
      function (button) {
        button.addEventListener(
          'click',
          function () {
            openUnitDetail(
              button.dataset.unitId
            );
          }
        );
      }
    );
}


async function openUnitDetail(
  unitId
) {
  if (
    !unitId
  ) {
    showToast(
      'No se pudo identificar la unidad.'
    );

    return;
  }

  openModal(`
    <div class="loading-card">
      Cargando unidad...
    </div>
  `);

  try {
    const unit =
      await apiCall(
        'getUnit',
        [
          state.token,
          unitId
        ]
      );

    const promises = [
      apiCall(
        'getUnitStock',
        [
          state.token,
          unitId
        ]
      ),

      apiCall(
        'getUnitTimeline',
        [
          state.token,
          unitId
        ]
      )
    ];

    if (
      unit.idPlantilla
    ) {
      promises.push(
        apiCall(
          'getTemplateDetail',
          [
            state.token,
            unit.idPlantilla
          ]
        )
      );
    }

    const results =
      await Promise.all(
        promises
      );

    const stock =
      extractArray(
        results[0],
        [
          'stock',
          'items',
          'rows'
        ]
      );

    const timeline =
      extractArray(
        results[1],
        [
          'timeline',
          'events',
          'rows'
        ]
      );

    const templateResponse =
      results[2] ||
      null;

    const templateItems =
      extractArray(
        templateResponse,
        [
          'items',
          'details',
          'detalle',
          'rows'
        ]
      );

    const unitItems =
      mergeTemplateAndStock(
        stock,
        templateItems
      );

    renderUnitDetail(
      unit,
      stock,
      timeline,
      unitItems
    );

  } catch (error) {
    openModal(`
      <h2>
        No se pudo abrir la unidad
      </h2>

      <div class="message">
        ${esc(error.message)}
      </div>
    `);
  }
}


// =========================================================
// FICHA OPERATIVA
// =========================================================

function renderUnitDetail(
  unit,
  stock,
  timeline,
  unitItems
) {
  const auditButton =
    state.user?.rol ===
    'CALIDAD'
      ? `
        <button
          type="button"
          class="button secondary"
          id="unitAudit"
        >
          Auditar
        </button>
      `
      : '';

  openModal(`

    <div class="unit-detail">


      <div class="unit-head">

        <div>

          <h2 style="margin:0 0 10px">

            ${esc(
              unit.codigo ||
              '-'
            )}

            ·

            ${esc(
              unit.nombre ||
              ''
            )}

          </h2>


          <div class="muted">

            ${statusBadge(
              unit.estado
            )}

            ${
              unit.tipoNombre
                ? ' · ' +
                  esc(
                    unit.tipoNombre
                  )
                : ''
            }

            ${
              unit.servicioNombre
                ? ' · ' +
                  esc(
                    unit.servicioNombre
                  )
                : ''
            }

            ${
              unit.ubicacion
                ? ' · ' +
                  esc(
                    unit.ubicacion
                  )
                : ''
            }

          </div>

        </div>

      </div>


      <div
        class="actions"
        style="
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin:20px 0 26px;
        "
      >

        <button
          type="button"
          class="button primary"
          id="unitVisoria"
        >
          Visoría
        </button>


        <button
          type="button"
          class="button secondary"
          id="unitUse"
        >
          Registrar uso
        </button>


        <button
          type="button"
          class="button secondary"
          id="unitReplenishment"
        >
          Reposición
        </button>


        ${auditButton}

      </div>


      <div class="section-title">
        <h3>
          Stock actual
        </h3>
      </div>


      ${renderUnitStockTable(
        stock
      )}


      <div
        class="section-title"
        style="margin-top:28px"
      >
        <h3>
          Línea de tiempo
        </h3>
      </div>


      ${renderUnitTimeline(
        timeline
      )}

    </div>
  `);


  $('#unitVisoria')
    ?.addEventListener(
      'click',
      function () {
        openUnitVisoria(
          unit,
          unitItems
        );
      }
    );


  $('#unitUse')
    ?.addEventListener(
      'click',
      function () {
        openUnitUse(
          unit,
          stock
        );
      }
    );


  $('#unitReplenishment')
    ?.addEventListener(
      'click',
      function () {
        openUnitReplenishment(
          unit,
          unitItems
        );
      }
    );


  $('#unitAudit')
    ?.addEventListener(
      'click',
      function () {
        openUnitAudit(
          unit
        );
      }
    );
}


// =========================================================
// STOCK
// =========================================================

function renderUnitStockTable(
  stock
) {
  const rows =
    stock.map(
      normalizeStockItem
    );

  return `
    <div class="table-wrap">

      <table>

        <thead>
          <tr>
            <th>Insumo</th>
            <th>Cantidad</th>
            <th>Lote</th>
            <th>Vencimiento</th>
          </tr>
        </thead>


        <tbody>

          ${
            rows.length
              ? rows
                  .map(
                    function (item) {
                      return `
                        <tr>

                          <td>
                            <strong>
                              ${esc(
                                item.nombre
                              )}
                            </strong>
                          </td>

                          <td>
                            ${esc(
                              item.cantidadActual
                            )}
                          </td>

                          <td>
                            ${esc(
                              item.numeroLote ||
                              '-'
                            )}
                          </td>

                          <td>
                            ${fmtDate(
                              item.fechaVencimiento
                            )}
                          </td>

                        </tr>
                      `;
                    }
                  )
                  .join('')
              : `
                <tr>
                  <td colspan="4">
                    Sin stock cargado.
                  </td>
                </tr>
              `
          }

        </tbody>

      </table>

    </div>
  `;
}


// =========================================================
// LÍNEA DE TIEMPO
// =========================================================

function renderUnitTimeline(
  timeline
) {
  if (
    !timeline.length
  ) {
    return `
      <div class="empty-state">
        Sin movimientos.
      </div>
    `;
  }

  return `
    <div class="grid">

      ${
        timeline
          .map(
            function (event) {
              const date =
                event.fechaHora ||
                event.fecha ||
                event.timestamp ||
                event.createdAt ||
                '';

              const type =
                event.tipoEvento ||
                event.tipo ||
                event.accion ||
                event.evento ||
                'Movimiento';

              const description =
                event.descripcion ||
                event.detalle ||
                event.observaciones ||
                event.descripcionEvento ||
                '';

              const user =
                event.nombreUsuario ||
                event.usuario ||
                event.idUsuario ||
                '';

              return `
                <article class="card">

                  <div class="unit-head">

                    <strong>
                      ${esc(type)}
                    </strong>

                    <span class="muted">
                      ${fmtDate(date)}
                    </span>

                  </div>


                  ${
                    description
                      ? `
                        <p>
                          ${esc(description)}
                        </p>
                      `
                      : ''
                  }


                  ${
                    user
                      ? `
                        <div class="muted">
                          Registrado por:
                          ${esc(user)}
                        </div>
                      `
                      : ''
                  }

                </article>
              `;
            }
          )
          .join('')
      }

    </div>
  `;
}


// =========================================================
// VISORÍA REAL
// =========================================================

function openUnitVisoria(
  unit,
  items
) {
  const usableItems =
    items.filter(
      function (item) {
        return item.idInsumo;
      }
    );

  openModal(`

    <h2>
      Visoría
    </h2>


    <p class="muted">

      ${esc(unit.codigo)}

      ·

      ${esc(unit.nombre)}

    </p>


    <form
      id="visoriaForm"
      class="form-stack"
    >

      <label>

        Resultado general

        <select
          id="visoriaResultado"
        >
          <option value="CONFORME">
            Conforme
          </option>

          <option value="NO_CONFORME">
            No conforme
          </option>
        </select>

      </label>


      <label>

        Observaciones generales

        <textarea
          id="visoriaObservaciones"
          placeholder="Observaciones del control..."
        ></textarea>

      </label>


      <div class="section-title">
        <h3>
          Control de insumos
        </h3>
      </div>


      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>Insumo</th>
              <th>Esperado</th>
              <th>Encontrado</th>
              <th>Estado</th>
              <th>Observación</th>
            </tr>
          </thead>


          <tbody>

            ${
              usableItems.length
                ? usableItems
                    .map(
                      function (
                        item,
                        index
                      ) {
                        const expected =
                          item.cantidadEsperada ||
                          item.cantidadActual ||
                          0;

                        return `
                          <tr
                            class="visoria-item"
                            data-id-insumo="${esc(
                              item.idInsumo
                            )}"
                          >

                            <td>
                              <strong>
                                ${esc(
                                  item.nombre
                                )}
                              </strong>
                            </td>


                            <td>

                              <input
                                class="visoria-esperada"
                                type="number"
                                min="0"
                                value="${esc(
                                  expected
                                )}"
                              >

                            </td>


                            <td>

                              <input
                                class="visoria-encontrada"
                                type="number"
                                min="0"
                                value="${esc(
                                  item.cantidadActual
                                )}"
                              >

                            </td>


                            <td>

                              <select
                                class="visoria-estado"
                              >
                                <option value="CONFORME">
                                  Conforme
                                </option>

                                <option value="FALTANTE">
                                  Faltante
                                </option>

                                <option value="VENCIDO">
                                  Vencido
                                </option>

                                <option value="OBSERVADO">
                                  Observado
                                </option>
                              </select>

                            </td>


                            <td>

                              <input
                                class="visoria-observacion"
                                type="text"
                                placeholder="Opcional"
                              >

                            </td>

                          </tr>
                        `;
                      }
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="5">
                      No se encontraron insumos asociados a esta unidad.
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>


      <div
        class="actions"
        style="
          display:flex;
          gap:10px;
          margin-top:20px;
          flex-wrap:wrap;
        "
      >

        <button
          type="button"
          class="button secondary"
          id="cancelVisoria"
        >
          Volver
        </button>


        <button
          type="submit"
          class="button primary"
          ${usableItems.length ? '' : 'disabled'}
        >
          Registrar visoría
        </button>

      </div>

    </form>
  `);


  $('#cancelVisoria')
    ?.addEventListener(
      'click',
      function () {
        openUnitDetail(
          unit.idUnidad
        );
      }
    );


  $('#visoriaForm')
    ?.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        const detalles =
          $$('.visoria-item')
            .map(
              function (row) {
                return {
                  idInsumo:
                    row.dataset.idInsumo,

                  cantidadEsperada:
                    numberValue(
                      row.querySelector(
                        '.visoria-esperada'
                      ).value
                    ),

                  cantidadEncontrada:
                    numberValue(
                      row.querySelector(
                        '.visoria-encontrada'
                      ).value
                    ),

                  estado:
                    row.querySelector(
                      '.visoria-estado'
                    ).value,

                  observacion:
                    row.querySelector(
                      '.visoria-observacion'
                    ).value.trim()
                };
              }
            );

        try {
          await apiCall(
            'createControl',
            [
              state.token,
              {
                idUnidad:
                  unit.idUnidad,

                tipoControl:
                  VISORIA_CONTROL_TYPE,

                resultado:
                  $('#visoriaResultado')
                    .value,

                observaciones:
                  $('#visoriaObservaciones')
                    .value
                    .trim(),

                detalles:
                  detalles
              }
            ]
          );

          showToast(
            'Visoría registrada correctamente.'
          );

          await openUnitDetail(
            unit.idUnidad
          );

        } catch (error) {
          showToast(
            error.message
          );
        }
      }
    );
}


// =========================================================
// REGISTRAR USO REAL
// =========================================================

function openUnitUse(
  unit,
  stock
) {
  const stockItems =
    stock
      .map(
        normalizeStockItem
      )
      .filter(
        function (item) {
          return (
            item.idInsumo &&
            item.cantidadActual > 0
          );
        }
      );

  openModal(`

    <h2>
      Registrar uso
    </h2>


    <p class="muted">

      ${esc(unit.codigo)}

      ·

      ${esc(unit.nombre)}

    </p>


    <form
      id="useForm"
      class="form-stack"
    >

      <label>

        Motivo del uso

        <input
          id="useReason"
          type="text"
          required
          placeholder="Ej.: Atención de emergencia"
        >

      </label>


      <label>

        Observaciones

        <textarea
          id="useObservations"
          placeholder="Observaciones del uso..."
        ></textarea>

      </label>


      <div class="section-title">
        <h3>
          Insumos utilizados
        </h3>
      </div>


      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>Insumo</th>
              <th>Disponible</th>
              <th>Lote</th>
              <th>Cantidad utilizada</th>
            </tr>
          </thead>


          <tbody>

            ${
              stockItems.length
                ? stockItems
                    .map(
                      function (item) {
                        return `
                          <tr
                            class="use-item"
                            data-id-insumo="${esc(
                              item.idInsumo
                            )}"
                            data-id-lote="${esc(
                              item.idLote
                            )}"
                          >

                            <td>
                              <strong>
                                ${esc(
                                  item.nombre
                                )}
                              </strong>
                            </td>


                            <td>
                              ${esc(
                                item.cantidadActual
                              )}
                            </td>


                            <td>
                              ${esc(
                                item.numeroLote ||
                                '-'
                              )}
                            </td>


                            <td>

                              <input
                                class="use-quantity"
                                type="number"
                                min="0"
                                max="${esc(
                                  item.cantidadActual
                                )}"
                                value="0"
                              >

                            </td>

                          </tr>
                        `;
                      }
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="4">
                      No hay stock disponible.
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>


      <div
        class="actions"
        style="
          display:flex;
          gap:10px;
          margin-top:20px;
          flex-wrap:wrap;
        "
      >

        <button
          type="button"
          class="button secondary"
          id="cancelUse"
        >
          Volver
        </button>


        <button
          type="submit"
          class="button primary"
          ${stockItems.length ? '' : 'disabled'}
        >
          Registrar uso
        </button>

      </div>

    </form>
  `);


  $('#cancelUse')
    ?.addEventListener(
      'click',
      function () {
        openUnitDetail(
          unit.idUnidad
        );
      }
    );


  $('#useForm')
    ?.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        const motivo =
          $('#useReason')
            .value
            .trim();

        if (!motivo) {
          showToast(
            'Debe indicar el motivo del uso.'
          );

          return;
        }

        const detalles =
          $$('.use-item')
            .map(
              function (row) {
                return {
                  idInsumo:
                    row.dataset.idInsumo,

                  idLote:
                    row.dataset.idLote ||
                    '',

                  cantidadUtilizada:
                    numberValue(
                      row.querySelector(
                        '.use-quantity'
                      ).value
                    )
                };
              }
            )
            .filter(
              function (detail) {
                return (
                  detail.cantidadUtilizada >
                  0
                );
              }
            );

        if (!detalles.length) {
          showToast(
            'Debe indicar al menos un insumo utilizado.'
          );

          return;
        }

        try {
          await apiCall(
            'registerUse',
            [
              state.token,
              {
                idUnidad:
                  unit.idUnidad,

                motivo:
                  motivo,

                observaciones:
                  $('#useObservations')
                    .value
                    .trim(),

                detalles:
                  detalles
              }
            ]
          );

          showToast(
            'Uso registrado correctamente.'
          );

          await openUnitDetail(
            unit.idUnidad
          );

        } catch (error) {
          showToast(
            error.message
          );
        }
      }
    );
}


// =========================================================
// REPOSICIÓN REAL
// =========================================================

function openUnitReplenishment(
  unit,
  items
) {
  const usableItems =
    items.filter(
      function (item) {
        return item.idInsumo;
      }
    );

  openModal(`

    <h2>
      Reposición
    </h2>


    <p class="muted">

      ${esc(unit.codigo)}

      ·

      ${esc(unit.nombre)}

    </p>


    <form
      id="replenishmentForm"
      class="form-stack"
    >

      <label>

        Observaciones

        <textarea
          id="replenishmentObservations"
          placeholder="Observaciones de la reposición..."
        ></textarea>

      </label>


      <div class="section-title">
        <h3>
          Insumos a reponer
        </h3>
      </div>


      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>Insumo</th>
              <th>Stock actual</th>
              <th>Cantidad</th>
              <th>Número de lote</th>
              <th>Vencimiento</th>
            </tr>
          </thead>


          <tbody>

            ${
              usableItems.length
                ? usableItems
                    .map(
                      function (item) {
                        return `
                          <tr
                            class="replenishment-item"
                            data-id-insumo="${esc(
                              item.idInsumo
                            )}"
                          >

                            <td>
                              <strong>
                                ${esc(
                                  item.nombre
                                )}
                              </strong>
                            </td>


                            <td>
                              ${esc(
                                item.cantidadActual ||
                                0
                              )}
                            </td>


                            <td>

                              <input
                                class="rep-quantity"
                                type="number"
                                min="0"
                                value="0"
                              >

                            </td>


                            <td>

                              <input
                                class="rep-lot"
                                type="text"
                                placeholder="Lote"
                              >

                            </td>


                            <td>

                              <input
                                class="rep-expiry"
                                type="date"
                              >

                            </td>

                          </tr>
                        `;
                      }
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="5">
                      No hay insumos asociados.
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>


      <div
        class="actions"
        style="
          display:flex;
          gap:10px;
          margin-top:20px;
          flex-wrap:wrap;
        "
      >

        <button
          type="button"
          class="button secondary"
          id="cancelReplenishment"
        >
          Volver
        </button>


        <button
          type="submit"
          class="button primary"
          ${usableItems.length ? '' : 'disabled'}
        >
          Registrar reposición
        </button>

      </div>

    </form>
  `);


  $('#cancelReplenishment')
    ?.addEventListener(
      'click',
      function () {
        openUnitDetail(
          unit.idUnidad
        );
      }
    );


  $('#replenishmentForm')
    ?.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        const detalles =
          $$('.replenishment-item')
            .map(
              function (row) {
                return {
                  idInsumo:
                    row.dataset.idInsumo,

                  cantidad:
                    numberValue(
                      row.querySelector(
                        '.rep-quantity'
                      ).value
                    ),

                  numeroLote:
                    row.querySelector(
                      '.rep-lot'
                    ).value.trim(),

                  fechaVencimiento:
                    row.querySelector(
                      '.rep-expiry'
                    ).value,

                  idLote:
                    ''
                };
              }
            )
            .filter(
              function (detail) {
                return (
                  detail.cantidad >
                  0
                );
              }
            );

        if (!detalles.length) {
          showToast(
            'Debe registrar al menos un insumo repuesto.'
          );

          return;
        }

        try {
          await apiCall(
            'registerReplenishment',
            [
              state.token,
              {
                idUnidad:
                  unit.idUnidad,

                observaciones:
                  $('#replenishmentObservations')
                    .value
                    .trim(),

                detalles:
                  detalles
              }
            ]
          );

          showToast(
            'Reposición registrada correctamente.'
          );

          await openUnitDetail(
            unit.idUnidad
          );

        } catch (error) {
          showToast(
            error.message
          );
        }
      }
    );
}


// =========================================================
// AUDITORÍA REAL
// =========================================================

function openUnitAudit(unit) {
  if (
    state.user?.rol !==
    'CALIDAD'
  ) {
    showToast(
      'La auditoría está reservada al Área de Calidad.'
    );

    return;
  }

  openModal(`

    <h2>
      Auditar unidad
    </h2>


    <p class="muted">

      ${esc(unit.codigo)}

      ·

      ${esc(unit.nombre)}

    </p>


    <form
      id="auditForm"
      class="form-stack"
    >

      <label>

        Resultado general

        <select
          id="auditResult"
          required
        >
          <option value="CONFORME">
            Conforme
          </option>

          <option value="CON_OBSERVACIONES">
            Conforme con observaciones
          </option>

          <option value="NO_CONFORME">
            No conforme
          </option>
        </select>

      </label>


      <label>

        Observaciones generales

        <textarea
          id="auditObservations"
          placeholder="Observaciones generales de la auditoría..."
        ></textarea>

      </label>


      <div class="section-title">

        <div>
          <h3>
            Hallazgos
          </h3>
        </div>


        <button
          type="button"
          class="button secondary"
          id="addAuditFinding"
        >
          + Agregar hallazgo
        </button>

      </div>


      <div
        id="auditFindings"
        class="grid"
      ></div>


      <div
        class="actions"
        style="
          display:flex;
          gap:10px;
          margin-top:20px;
          flex-wrap:wrap;
        "
      >

        <button
          type="button"
          class="button secondary"
          id="cancelAudit"
        >
          Volver
        </button>


        <button
          type="submit"
          class="button primary"
        >
          Finalizar auditoría
        </button>

      </div>

    </form>
  `);


  $('#cancelAudit')
    ?.addEventListener(
      'click',
      function () {
        openUnitDetail(
          unit.idUnidad
        );
      }
    );


  $('#addAuditFinding')
    ?.addEventListener(
      'click',
      addAuditFindingRow
    );


  $('#auditForm')
    ?.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        const hallazgos =
          $$('.audit-finding')
            .map(
              function (card) {
                const descripcion =
                  card.querySelector(
                    '.finding-description'
                  ).value.trim();

                if (!descripcion) {
                  return null;
                }

                return {
                  tipoHallazgo:
                    card.querySelector(
                      '.finding-type'
                    ).value.trim() ||
                    'GENERAL',

                  clasificacion:
                    card.querySelector(
                      '.finding-classification'
                    ).value,

                  descripcion:
                    descripcion,

                  requiereRespuesta:
                    card.querySelector(
                      '.finding-response'
                    ).checked,

                  requiereAccionMejora:
                    card.querySelector(
                      '.finding-action'
                    ).checked,

                  fechaLimite:
                    card.querySelector(
                      '.finding-deadline'
                    ).value,

                  feedback:
                    card.querySelector(
                      '.finding-feedback'
                    ).value.trim()
                };
              }
            )
            .filter(Boolean);

        try {
          await apiCall(
            'createAudit',
            [
              state.token,
              {
                idUnidad:
                  unit.idUnidad,

                resultadoGeneral:
                  $('#auditResult')
                    .value,

                observacionesGenerales:
                  $('#auditObservations')
                    .value
                    .trim(),

                hallazgos:
                  hallazgos
              }
            ]
          );

          showToast(
            'Auditoría registrada correctamente.'
          );

          await openUnitDetail(
            unit.idUnidad
          );

        } catch (error) {
          showToast(
            error.message
          );
        }
      }
    );
}


function addAuditFindingRow() {
  const container =
    $('#auditFindings');

  if (!container) {
    return;
  }

  const card =
    document.createElement(
      'div'
    );

  card.className =
    'card audit-finding';

  card.innerHTML = `

    <div class="unit-head">

      <strong>
        Hallazgo
      </strong>


      <button
        type="button"
        class="button secondary remove-finding"
      >
        Quitar
      </button>

    </div>


    <label>

      Tipo de hallazgo

      <input
        class="finding-type"
        type="text"
        value="GENERAL"
      >

    </label>


    <label>

      Clasificación

      <select
        class="finding-classification"
      >
        <option value="OBSERVACION">
          Observación
        </option>

        <option value="CRITICO">
          Crítico
        </option>
      </select>

    </label>


    <label>

      Descripción

      <textarea
        class="finding-description"
        required
      ></textarea>

    </label>


    <label>

      Feedback para el servicio

      <textarea
        class="finding-feedback"
      ></textarea>

    </label>


    <label>

      Fecha límite

      <input
        class="finding-deadline"
        type="date"
      >

    </label>


    <label>

      <input
        class="finding-response"
        type="checkbox"
        style="width:auto"
      >

      Requiere respuesta del servicio

    </label>


    <label>

      <input
        class="finding-action"
        type="checkbox"
        style="width:auto"
      >

      Requiere acción de mejora

    </label>
  `;

  container.appendChild(
    card
  );

  card.querySelector(
    '.remove-finding'
  )
    ?.addEventListener(
      'click',
      function () {
        card.remove();
      }
    );
}


// =========================================================
// ALERTAS
// =========================================================

async function renderAlerts() {
  const alerts =
    await apiCall(
      'listAlerts',
      [
        state.token
      ]
    );

  $('#content')
    .innerHTML =
      alertsTable(
        Array.isArray(alerts)
          ? alerts
          : []
      );
}


function alertsTable(alerts) {
  return `
    <div class="table-wrap">

      <table>

        <thead>
          <tr>
            <th>Nivel</th>
            <th>Tipo</th>
            <th>Descripción</th>
            <th>Fecha</th>
          </tr>
        </thead>


        <tbody>

          ${
            alerts.length
              ? alerts
                  .map(
                    function (alert) {
                      return `
                        <tr>

                          <td>
                            ${esc(
                              alert.nivel
                            )}
                          </td>

                          <td>
                            ${esc(
                              alert.tipo
                            )}
                          </td>

                          <td>
                            ${esc(
                              alert.descripcion
                            )}
                          </td>

                          <td>
                            ${fmtDate(
                              alert.fechaGeneracion
                            )}
                          </td>

                        </tr>
                      `;
                    }
                  )
                  .join('')
              : `
                <tr>
                  <td colspan="4">
                    Sin alertas abiertas.
                  </td>
                </tr>
              `
          }

        </tbody>

      </table>

    </div>
  `;
}


// =========================================================
// FEEDBACK
// =========================================================

async function renderFeedback() {
  const rows =
    await apiCall(
      'listMyAuditFeedback',
      [
        state.token
      ]
    );

  $('#content')
    .innerHTML = `

      <div class="grid">

        ${
          Array.isArray(rows) &&
          rows.length
            ? rows
                .map(
                  function (row) {
                    return `
                      <article class="card">

                        <div class="unit-head">

                          <strong>
                            ${esc(
                              row.estado ||
                              'Feedback'
                            )}
                          </strong>

                          <span class="muted">
                            ${fmtDate(
                              row.fechaEnvio
                            )}
                          </span>

                        </div>


                        <p>
                          ${esc(
                            row.mensajeCalidad ||
                            row.descripcion ||
                            ''
                          )}
                        </p>


                        ${
                          row.respuestaServicio
                            ? `
                              <div class="loading-card">

                                <strong>
                                  Respuesta del servicio
                                </strong>

                                <p>
                                  ${esc(
                                    row.respuestaServicio
                                  )}
                                </p>

                              </div>
                            `
                            : ''
                        }

                      </article>
                    `;
                  }
                )
                .join('')
            : `
              <div class="empty-state">
                No hay devoluciones de auditoría pendientes.
              </div>
            `
        }

      </div>
    `;
}


// =========================================================
// ADMINISTRACIÓN
// =========================================================

async function renderAdmin() {
  if (
    !state.user ||
    state.user.rol !==
      'CALIDAD'
  ) {
    throw new Error(
      'Acceso restringido.'
    );
  }

  const data =
    await apiCall(
      'adminGetMasterData',
      [
        state.token
      ]
    );

  state.adminData =
    data ||
    {};

  $('#content')
    .innerHTML = `

      <div class="admin-tabs">

        <button
          type="button"
          class="admin-tab active"
          data-admin-section="services"
        >
          Servicios
        </button>


        <button
          type="button"
          class="admin-tab"
          data-admin-section="users"
        >
          Usuarios
        </button>


        <button
          type="button"
          class="admin-tab"
          data-admin-section="units"
        >
          Unidades
        </button>


        <button
          type="button"
          class="admin-tab"
          data-admin-section="catalog"
        >
          Catálogo
        </button>


        <button
          type="button"
          class="admin-tab"
          data-admin-section="templates"
        >
          Plantillas
        </button>


        <button
          type="button"
          class="admin-tab"
          data-admin-section="types"
        >
          Frecuencias
        </button>


        <button
          type="button"
          class="admin-tab"
          data-admin-section="config"
        >
          Configuración
        </button>

      </div>


      <div id="adminPanel"></div>
    `;

  $$('.admin-tab')
    .forEach(
      function (button) {
        button.addEventListener(
          'click',
          function () {
            $$('.admin-tab')
              .forEach(
                function (tab) {
                  tab.classList.remove(
                    'active'
                  );
                }
              );

            button.classList.add(
              'active'
            );

            renderAdminSection(
              button.dataset.adminSection,
              state.adminData
            );
          }
        );
      }
    );

  renderAdminSection(
    'services',
    state.adminData
  );
}


// =========================================================
// ENRUTADOR ADMIN
// =========================================================

function renderAdminSection(
  section,
  data
) {
  if (
    section ===
    'services'
  ) {
    return renderAdminServices(
      data
    );
  }

  if (
    section ===
    'users'
  ) {
    return renderAdminUsers(
      data
    );
  }

  if (
    section ===
    'units'
  ) {
    return renderAdminUnits(
      data
    );
  }

  if (
    section ===
    'catalog'
  ) {
    return renderAdminCatalog(
      data
    );
  }

  if (
    section ===
    'templates'
  ) {
    return renderAdminTemplates(
      data
    );
  }

  if (
    section ===
    'types'
  ) {
    return renderAdminTypes(
      data
    );
  }

  if (
    section ===
    'config'
  ) {
    return renderAdminConfig(
      data
    );
  }
}


async function refreshAdminData() {
  state.adminData =
    await apiCall(
      'adminGetMasterData',
      [
        state.token
      ]
    );

  return state.adminData;
}


async function refreshAdminSection(
  section
) {
  const data =
    await refreshAdminData();

  renderAdminSection(
    section,
    data
  );

  $$('.admin-tab')
    .forEach(
      function (button) {
        button.classList.toggle(
          'active',
          button.dataset.adminSection ===
            section
        );
      }
    );
}


// =========================================================
// ADMIN - SERVICIOS
// =========================================================

function renderAdminServices(data) {
  const services =
    Array.isArray(
      data.services
    )
      ? data.services
      : [];

  $('#adminPanel')
    .innerHTML = `

      <div class="section-title admin-section-title">

        <div>

          <h3>
            Servicios
          </h3>

          <div class="muted">
            Cada servicio administra únicamente sus propias unidades.
          </div>

        </div>


        <button
          type="button"
          id="adminNewService"
          class="button primary"
        >
          Nuevo servicio
        </button>

      </div>


      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>Servicio</th>
              <th>Establecimiento</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>


          <tbody>

            ${
              services.length
                ? services
                    .map(
                      function (service) {
                        const active =
                          asBool(
                            service.activo
                          );

                        return `
                          <tr>

                            <td>
                              <strong>
                                ${esc(
                                  service.nombreServicio
                                )}
                              </strong>
                            </td>

                            <td>
                              ${esc(
                                service.establecimiento ||
                                '-'
                              )}
                            </td>

                            <td>
                              ${
                                active
                                  ? statusBadge(
                                      'ACTIVO'
                                    )
                                  : statusBadge(
                                      'INACTIVO'
                                    )
                              }
                            </td>

                            <td>

                              <button
                                type="button"
                                class="button secondary edit-service"
                                data-id="${esc(
                                  service.idServicio
                                )}"
                              >
                                Editar
                              </button>

                            </td>

                          </tr>
                        `;
                      }
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="4">
                      No hay servicios registrados.
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>
    `;


  $('#adminNewService')
    ?.addEventListener(
      'click',
      openNewService
    );


  $$('.edit-service')
    .forEach(
      function (button) {
        button.addEventListener(
          'click',
          function () {
            const service =
              services.find(
                function (item) {
                  return (
                    item.idServicio ===
                    button.dataset.id
                  );
                }
              );

            if (
              service
            ) {
              openEditService(
                service
              );
            }
          }
        );
      }
    );
}


function openNewService() {
  openModal(`

    <h2>
      Nuevo servicio
    </h2>


    <form
      id="serviceForm"
      class="form-stack"
    >

      <label>
        Nombre del servicio

        <input
          id="svcName"
          required
        >
      </label>


      <label>
        Establecimiento

        <input
          id="svcSite"
        >
      </label>


      <button
        type="submit"
        class="button primary"
      >
        Crear servicio
      </button>

    </form>
  `);


  $('#serviceForm')
    ?.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        try {
          await apiCall(
            'adminCreateService',
            [
              state.token,
              {
                nombreServicio:
                  $('#svcName')
                    .value
                    .trim(),

                establecimiento:
                  $('#svcSite')
                    .value
                    .trim()
              }
            ]
          );

          showToast(
            'Servicio creado.'
          );

          closeModal();

          await refreshAdminSection(
            'services'
          );

        } catch (error) {
          showToast(
            error.message
          );
        }
      }
    );
}


function openEditService(service) {
  const active =
    asBool(
      service.activo
    );

  openModal(`

    <h2>
      Editar servicio
    </h2>


    <form
      id="editServiceForm"
      class="form-stack"
    >

      <label>
        Servicio

        <input
          id="editServiceName"
          value="${esc(
            service.nombreServicio
          )}"
          required
        >
      </label>


      <label>
        Establecimiento

        <input
          id="editServiceSite"
          value="${esc(
            service.establecimiento ||
            ''
          )}"
        >
      </label>


      <label>
        Estado

        <select
          id="editServiceActive"
        >

          <option
            value="true"
            ${active ? 'selected' : ''}
          >
            Activo
          </option>

          <option
            value="false"
            ${!active ? 'selected' : ''}
          >
            Inactivo
          </option>

        </select>
      </label>


      <button
        type="submit"
        class="button primary"
      >
        Guardar cambios
      </button>

    </form>
  `);


  $('#editServiceForm')
    ?.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        try {
          await apiCall(
            'adminUpdateService',
            [
              state.token,

              service.idServicio,

              {
                nombreServicio:
                  $('#editServiceName')
                    .value
                    .trim(),

                establecimiento:
                  $('#editServiceSite')
                    .value
                    .trim(),

                activo:
                  $('#editServiceActive')
                    .value ===
                  'true'
              }
            ]
          );

          showToast(
            'Servicio actualizado.'
          );

          closeModal();

          await refreshAdminSection(
            'services'
          );

        } catch (error) {
          showToast(
            error.message
          );
        }
      }
    );
}


// =========================================================
// ADMIN - USUARIOS
// =========================================================

function renderAdminUsers(data) {
  const users =
    Array.isArray(
      data.users
    )
      ? data.users
      : [];

  const services =
    Array.isArray(
      data.services
    )
      ? data.services
      : [];

  $('#adminPanel')
    .innerHTML = `

      <div class="section-title admin-section-title">

        <div>
          <h3>
            Usuarios
          </h3>

          <div class="muted">
            Gestión de accesos institucionales.
          </div>
        </div>


        <button
          type="button"
          id="adminNewUser"
          class="button primary"
        >
          Nuevo usuario
        </button>

      </div>


      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Servicio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>


          <tbody>

            ${
              users.length
                ? users
                    .map(
                      function (user) {
                        const active =
                          String(
                            user.estado ||
                            ''
                          ).toUpperCase() ===
                          'ACTIVO';

                        return `
                          <tr>

                            <td>
                              <strong>
                                ${esc(
                                  user.usuario
                                )}
                              </strong>
                            </td>

                            <td>
                              ${esc(
                                user.nombre ||
                                '-'
                              )}
                            </td>

                            <td>
                              ${esc(
                                user.rol ||
                                '-'
                              )}
                            </td>

                            <td>
                              ${esc(
                                adminServiceName(
                                  user.idServicio,
                                  services
                                )
                              )}
                            </td>

                            <td>
                              ${statusBadge(
                                user.estado
                              )}
                            </td>

                            <td>

                              ${
                                user.rol ===
                                'SERVICIO'
                                  ? `
                                    <div class="actions">

                                      <button
                                        type="button"
                                        class="button secondary reset-user"
                                        data-id="${esc(
                                          user.idUsuario
                                        )}"
                                        data-user="${esc(
                                          user.usuario
                                        )}"
                                      >
                                        Nueva clave
                                      </button>


                                      <button
                                        type="button"
                                        class="button secondary toggle-user"
                                        data-id="${esc(
                                          user.idUsuario
                                        )}"
                                        data-status="${
                                          active
                                            ? 'INACTIVO'
                                            : 'ACTIVO'
                                        }"
                                      >
                                        ${
                                          active
                                            ? 'Desactivar'
                                            : 'Activar'
                                        }
                                      </button>

                                    </div>
                                  `
                                  : 'Administrador'
                              }

                            </td>

                          </tr>
                        `;
                      }
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="6">
                      No hay usuarios registrados.
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>
    `;


  $('#adminNewUser')
    ?.addEventListener(
      'click',
      function () {
        openNewUser(
          services
        );
      }
    );


  $$('.toggle-user')
    .forEach(
      function (button) {
        button.addEventListener(
          'click',
          async function () {
            try {
              await apiCall(
                'adminSetUserStatus',
                [
                  state.token,
                  button.dataset.id,
                  button.dataset.status
                ]
              );

              showToast(
                'Estado actualizado.'
              );

              await refreshAdminSection(
                'users'
              );

            } catch (error) {
              showToast(
                error.message
              );
            }
          }
        );
      }
    );


  $$('.reset-user')
    .forEach(
      function (button) {
        button.addEventListener(
          'click',
          function () {
            openResetPassword(
              button.dataset.id,
              button.dataset.user
            );
          }
        );
      }
    );
}


function openNewUser(services) {
  const activeServices =
    services.filter(
      function (service) {
        return asBool(
          service.activo
        );
      }
    );

  openModal(`

    <h2>
      Nuevo usuario
    </h2>


    <form
      id="userForm"
      class="form-stack"
    >

      <label>
        Nombre

        <input
          id="usrName"
          required
        >
      </label>


      <label>
        Usuario

        <input
          id="usrUser"
          required
        >
      </label>


      <label>
        Contraseña temporal

        <input
          id="usrPass"
          type="password"
          minlength="8"
          required
        >
      </label>


      <label>
        Servicio

        <select
          id="usrSvc"
          required
        >

          <option value="">
            Seleccione
          </option>

          ${
            activeServices
              .map(
                function (service) {
                  return `
                    <option
                      value="${esc(
                        service.idServicio
                      )}"
                    >
                      ${esc(
                        service.nombreServicio
                      )}
                    </option>
                  `;
                }
              )
              .join('')
          }

        </select>
      </label>


      <button
        type="submit"
        class="button primary"
      >
        Crear usuario
      </button>

    </form>
  `);


  $('#userForm')
    ?.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        try {
          await apiCall(
            'adminCreateServiceUser',
            [
              state.token,
              {
                nombre:
                  $('#usrName')
                    .value
                    .trim(),

                usuario:
                  $('#usrUser')
                    .value
                    .trim(),

                password:
                  $('#usrPass')
                    .value,

                idServicio:
                  $('#usrSvc')
                    .value
              }
            ]
          );

          showToast(
            'Usuario creado.'
          );

          closeModal();

          await refreshAdminSection(
            'users'
          );

        } catch (error) {
          showToast(
            error.message
          );
        }
      }
    );
}


function openResetPassword(
  userId,
  username
) {
  openModal(`

    <h2>
      Restablecer contraseña
    </h2>


    <p>
      Usuario:
      <strong>
        ${esc(username)}
      </strong>
    </p>


    <form
      id="resetPasswordForm"
      class="form-stack"
    >

      <label>
        Nueva contraseña temporal

        <input
          id="resetPasswordValue"
          type="password"
          minlength="8"
          required
        >
      </label>


      <label>
        Confirmar contraseña

        <input
          id="resetPasswordConfirm"
          type="password"
          minlength="8"
          required
        >
      </label>


      <button
        type="submit"
        class="button primary"
      >
        Restablecer contraseña
      </button>

    </form>
  `);


  $('#resetPasswordForm')
    ?.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        const password =
          $('#resetPasswordValue')
            .value;

        const confirm =
          $('#resetPasswordConfirm')
            .value;

        if (
          password !==
          confirm
        ) {
          showToast(
            'Las contraseñas no coinciden.'
          );

          return;
        }

        try {
          await apiCall(
            'adminResetUserPassword',
            [
              state.token,
              userId,
              password
            ]
          );

          showToast(
            'Contraseña actualizada.'
          );

          closeModal();

        } catch (error) {
          showToast(
            error.message
          );
        }
      }
    );
}


// =========================================================
// ADMIN - UNIDADES
// =========================================================

function renderAdminUnits(data) {
  const units =
    Array.isArray(
      data.units
    )
      ? data.units
      : [];

  $('#adminPanel')
    .innerHTML = `

      <div class="section-title admin-section-title">

        <div>

          <h3>
            Unidades
          </h3>

          <div class="muted">
            Unidades de Respuesta a Emergencias.
          </div>

        </div>


        <button
          type="button"
          id="adminNewUnit"
          class="button primary"
        >
          Nueva unidad
        </button>

      </div>


      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Servicio</th>
              <th>Plantilla</th>
              <th>Estado</th>
            </tr>
          </thead>


          <tbody>

            ${
              units.length
                ? units
                    .map(
                      function (unit) {
                        return `
                          <tr>

                            <td>
                              <strong>
                                ${esc(
                                  unit.codigo
                                )}
                              </strong>
                            </td>

                            <td>
                              ${esc(
                                unit.nombre
                              )}
                            </td>

                            <td>
                              ${esc(
                                adminTypeName(
                                  unit.idTipoUnidad,
                                  data.types ||
                                  []
                                )
                              )}
                            </td>

                            <td>
                              ${esc(
                                adminServiceName(
                                  unit.idServicio,
                                  data.services ||
                                  []
                                )
                              )}
                            </td>

                            <td>
                              ${esc(
                                adminTemplateName(
                                  unit.idPlantilla,
                                  data.templates ||
                                  []
                                )
                              )}
                            </td>

                            <td>
                              ${statusBadge(
                                unit.estado
                              )}
                            </td>

                          </tr>
                        `;
                      }
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="6">
                      No hay unidades registradas.
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>
    `;


  $('#adminNewUnit')
    ?.addEventListener(
      'click',
      function () {
        openNewUnit(
          data.services ||
          [],

          data.types ||
          [],

          data.templates ||
          []
        );
      }
    );
}


function openNewUnit(
  services,
  types,
  templates
) {
  const activeServices =
    services.filter(
      function (service) {
        return asBool(
          service.activo
        );
      }
    );

  openModal(`

    <h2>
      Nueva unidad
    </h2>


    <form
      id="unitForm"
      class="form-stack"
    >

      <label>
        Código institucional

        <input
          id="uniCode"
          required
        >
      </label>


      <label>
        Nombre

        <input
          id="uniName"
          required
        >
      </label>


      <label>
        Tipo

        <select
          id="uniType"
          required
        >
          <option value="">
            Seleccione
          </option>

          ${
            types
              .map(
                function (type) {
                  return `
                    <option
                      value="${esc(
                        type.idTipoUnidad
                      )}"
                    >
                      ${esc(
                        type.nombre
                      )}
                    </option>
                  `;
                }
              )
              .join('')
          }

        </select>
      </label>


      <label>
        Servicio

        <select
          id="uniSvc"
          required
        >
          <option value="">
            Seleccione
          </option>

          ${
            activeServices
              .map(
                function (service) {
                  return `
                    <option
                      value="${esc(
                        service.idServicio
                      )}"
                    >
                      ${esc(
                        service.nombreServicio
                      )}
                    </option>
                  `;
                }
              )
              .join('')
          }

        </select>
      </label>


      <label>
        Ubicación

        <input
          id="uniLocation"
        >
      </label>


      <label>
        Plantilla

        <select
          id="uniTpl"
        >
          <option value="">
            Sin plantilla
          </option>

          ${
            templates
              .map(
                function (template) {
                  return `
                    <option
                      value="${esc(
                        template.idPlantilla
                      )}"
                    >
                      ${esc(
                        template.nombre
                      )}
                      v${esc(
                        template.version
                      )}
                    </option>
                  `;
                }
              )
              .join('')
          }

        </select>
      </label>


      <button
        type="submit"
        class="button primary"
      >
        Crear unidad
      </button>

    </form>
  `);


  $('#unitForm')
    ?.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        try {
          await apiCall(
            'adminCreateUnit',
            [
              state.token,
              {
                codigo:
                  $('#uniCode')
                    .value
                    .trim(),

                nombre:
                  $('#uniName')
                    .value
                    .trim(),

                idTipoUnidad:
                  $('#uniType')
                    .value,

                idServicio:
                  $('#uniSvc')
                    .value,

                ubicacion:
                  $('#uniLocation')
                    .value
                    .trim(),

                idPlantilla:
                  $('#uniTpl')
                    .value
              }
            ]
          );

          showToast(
            'Unidad creada.'
          );

          closeModal();

          await refreshAdminSection(
            'units'
          );

        } catch (error) {
          showToast(
            error.message
          );
        }
      }
    );
}


// =========================================================
// ADMIN - CATÁLOGO
// =========================================================

function renderAdminCatalog(data) {
  const catalog =
    Array.isArray(
      data.catalog
    )
      ? data.catalog
      : [];

  $('#adminPanel')
    .innerHTML = `

      <div class="section-title admin-section-title">

        <div>

          <h3>
            Catálogo maestro
          </h3>

          <div class="muted">
            Insumos institucionales.
          </div>

        </div>


        <button
          type="button"
          id="adminNewItem"
          class="button primary"
        >
          Nuevo insumo
        </button>

      </div>


      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>Código</th>
              <th>Insumo</th>
              <th>Categoría</th>
              <th>Unidad</th>
              <th>Crítico</th>
              <th>Estado</th>
            </tr>
          </thead>


          <tbody>

            ${
              catalog.length
                ? catalog
                    .map(
                      function (item) {
                        return `
                          <tr>

                            <td>
                              ${esc(
                                item.codigo
                              )}
                            </td>

                            <td>
                              <strong>
                                ${esc(
                                  item.nombre
                                )}
                              </strong>
                            </td>

                            <td>
                              ${esc(
                                item.categoria ||
                                '-'
                              )}
                            </td>

                            <td>
                              ${esc(
                                item.unidadMedida ||
                                '-'
                              )}
                            </td>

                            <td>
                              ${
                                asBool(
                                  item.esCritico
                                )
                                  ? 'Sí'
                                  : 'No'
                              }
                            </td>

                            <td>
                              ${
                                asBool(
                                  item.activo
                                )
                                  ? statusBadge(
                                      'ACTIVO'
                                    )
                                  : statusBadge(
                                      'INACTIVO'
                                    )
                              }
                            </td>

                          </tr>
                        `;
                      }
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="6">
                      No hay insumos registrados.
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>
    `;


  $('#adminNewItem')
    ?.addEventListener(
      'click',
      openNewItem
    );
}


function openNewItem() {
  openModal(`

    <h2>
      Nuevo insumo
    </h2>


    <form
      id="itemForm"
      class="form-stack"
    >

      <label>
        Código

        <input
          id="itmCode"
          required
        >
      </label>


      <label>
        Nombre

        <input
          id="itmName"
          required
        >
      </label>


      <label>
        Categoría

        <input
          id="itmCat"
          required
        >
      </label>


      <label>
        Unidad de medida

        <input
          id="itmUnit"
          required
        >
      </label>


      <label>
        Insumo crítico

        <input
          id="itmCritical"
          type="checkbox"
          style="width:auto"
        >
      </label>


      <button
        type="submit"
        class="button primary"
      >
        Crear insumo
      </button>

    </form>
  `);


  $('#itemForm')
    ?.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        try {
          await apiCall(
            'adminCreateItem',
            [
              state.token,
              {
                codigo:
                  $('#itmCode')
                    .value
                    .trim(),

                nombre:
                  $('#itmName')
                    .value
                    .trim(),

                categoria:
                  $('#itmCat')
                    .value
                    .trim(),

                unidadMedida:
                  $('#itmUnit')
                    .value
                    .trim(),

                esCritico:
                  $('#itmCritical')
                    .checked
              }
            ]
          );

          showToast(
            'Insumo creado.'
          );

          closeModal();

          await refreshAdminSection(
            'catalog'
          );

        } catch (error) {
          showToast(
            error.message
          );
        }
      }
    );
}


// =========================================================
// ADMIN - PLANTILLAS
// =========================================================

function renderAdminTemplates(data) {
  const templates =
    Array.isArray(
      data.templates
    )
      ? data.templates
      : [];

  $('#adminPanel')
    .innerHTML = `

      <div class="section-title admin-section-title">

        <div>

          <h3>
            Plantillas
          </h3>

          <div class="muted">
            Composición estandarizada de las unidades.
          </div>

        </div>


        <button
          type="button"
          id="adminNewTemplate"
          class="button primary"
        >
          Nueva plantilla
        </button>

      </div>


      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>Plantilla</th>
              <th>Versión</th>
              <th>Tipo</th>
              <th>Vigencia</th>
              <th>Acción</th>
            </tr>
          </thead>


          <tbody>

            ${
              templates.length
                ? templates
                    .map(
                      function (template) {
                        return `
                          <tr>

                            <td>
                              <strong>
                                ${esc(
                                  template.nombre
                                )}
                              </strong>
                            </td>

                            <td>
                              ${esc(
                                template.version
                              )}
                            </td>

                            <td>
                              ${esc(
                                adminTypeName(
                                  template.idTipoUnidad,
                                  data.types ||
                                  []
                                )
                              )}
                            </td>

                            <td>
                              ${fmtDate(
                                template.fechaVigencia
                              )}
                            </td>

                            <td>

                              <button
                                type="button"
                                class="button secondary add-template-item"
                                data-id="${esc(
                                  template.idPlantilla
                                )}"
                              >
                                Agregar contenido
                              </button>

                            </td>

                          </tr>
                        `;
                      }
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="5">
                      No hay plantillas registradas.
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>
    `;


  $('#adminNewTemplate')
    ?.addEventListener(
      'click',
      function () {
        openNewTemplate(
          data.types ||
          []
        );
      }
    );


  $$('.add-template-item')
    .forEach(
      function (button) {
        button.addEventListener(
          'click',
          function () {
            openTemplateItem(
              button.dataset.id,
              data.catalog ||
              []
            );
          }
        );
      }
    );
}


function openNewTemplate(types) {
  openModal(`

    <h2>
      Nueva plantilla
    </h2>


    <form
      id="templateForm"
      class="form-stack"
    >

      <label>
        Nombre

        <input
          id="tplName"
          required
        >
      </label>


      <label>
        Versión

        <input
          id="tplVersion"
          value="1.0"
          required
        >
      </label>


      <label>
        Tipo

        <select
          id="tplType"
          required
        >
          <option value="">
            Seleccione
          </option>

          ${
            types
              .map(
                function (type) {
                  return `
                    <option
                      value="${esc(
                        type.idTipoUnidad
                      )}"
                    >
                      ${esc(
                        type.nombre
                      )}
                    </option>
                  `;
                }
              )
              .join('')
          }

        </select>
      </label>


      <label>
        Fecha de vigencia

        <input
          id="tplDate"
          type="date"
        >
      </label>


      <button
        type="submit"
        class="button primary"
      >
        Crear plantilla
      </button>

    </form>
  `);


  $('#templateForm')
    ?.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        try {
          await apiCall(
            'adminCreateTemplate',
            [
              state.token,
              {
                nombre:
                  $('#tplName')
                    .value
                    .trim(),

                version:
                  $('#tplVersion')
                    .value
                    .trim(),

                idTipoUnidad:
                  $('#tplType')
                    .value,

                fechaVigencia:
                  $('#tplDate')
                    .value
              }
            ]
          );

          showToast(
            'Plantilla creada.'
          );

          closeModal();

          await refreshAdminSection(
            'templates'
          );

        } catch (error) {
          showToast(
            error.message
          );
        }
      }
    );
}


function openTemplateItem(
  templateId,
  catalog
) {
  openModal(`

    <h2>
      Agregar contenido
    </h2>


    <form
      id="templateItemForm"
      class="form-stack"
    >

      <label>
        Insumo

        <select
          id="tpiItem"
          required
        >

          <option value="">
            Seleccione
          </option>

          ${
            catalog
              .map(
                function (item) {
                  return `
                    <option
                      value="${esc(
                        item.idInsumo
                      )}"
                    >
                      ${esc(
                        item.codigo
                      )}
                      ·
                      ${esc(
                        item.nombre
                      )}
                    </option>
                  `;
                }
              )
              .join('')
          }

        </select>
      </label>


      <label>
        Compartimiento

        <input
          id="tpiComp"
        >
      </label>


      <label>
        Cantidad requerida

        <input
          id="tpiReq"
          type="number"
          min="1"
          value="1"
          required
        >
      </label>


      <label>
        Cantidad mínima

        <input
          id="tpiMin"
          type="number"
          min="0"
          value="1"
        >
      </label>


      <label>
        Crítico

        <input
          id="tpiCritical"
          type="checkbox"
          style="width:auto"
        >
      </label>


      <label>
        Orden

        <input
          id="tpiOrder"
          type="number"
          value="0"
        >
      </label>


      <button
        type="submit"
        class="button primary"
      >
        Agregar insumo
      </button>

    </form>
  `);


  $('#templateItemForm')
    ?.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        try {
          await apiCall(
            'adminAddTemplateItem',
            [
              state.token,
              {
                idPlantilla:
                  templateId,

                idInsumo:
                  $('#tpiItem')
                    .value,

                compartimiento:
                  $('#tpiComp')
                    .value
                    .trim(),

                cantidadRequerida:
                  Number(
                    $('#tpiReq')
                      .value
                  ),

                cantidadMinima:
                  Number(
                    $('#tpiMin')
                      .value
                  ),

                esCritico:
                  $('#tpiCritical')
                    .checked,

                orden:
                  Number(
                    $('#tpiOrder')
                      .value
                  )
              }
            ]
          );

          showToast(
            'Insumo agregado.'
          );

          closeModal();

        } catch (error) {
          showToast(
            error.message
          );
        }
      }
    );
}


// =========================================================
// ADMIN - FRECUENCIAS
// =========================================================

function renderAdminTypes(data) {
  const types =
    Array.isArray(
      data.types
    )
      ? data.types
      : [];

  $('#adminPanel')
    .innerHTML = `

      <div class="section-title">

        <div>

          <h3>
            Frecuencias
          </h3>

          <div class="muted">
            Frecuencia de visorías y controles preventivos.
          </div>

        </div>

      </div>


      <div class="grid units-grid">

        ${
          types.length
            ? types
                .map(
                  function (type) {
                    return `

                      <div class="card">

                        <h3>
                          ${esc(
                            type.nombre
                          )}
                        </h3>


                        <label>
                          Visoría cada (horas)

                          <input
                            class="type-visoria"
                            data-id="${esc(
                              type.idTipoUnidad
                            )}"
                            type="number"
                            min="1"
                            value="${esc(
                              type.frecuenciaVisoriaHoras
                            )}"
                          >
                        </label>


                        <label>
                          Preventivo cada (días)

                          <input
                            class="type-preventivo"
                            data-id="${esc(
                              type.idTipoUnidad
                            )}"
                            type="number"
                            min="1"
                            value="${esc(
                              type.frecuenciaPreventivoDias
                            )}"
                          >
                        </label>


                        <button
                          type="button"
                          class="button primary save-type"
                          data-id="${esc(
                            type.idTipoUnidad
                          )}"
                        >
                          Guardar
                        </button>

                      </div>
                    `;
                  }
                )
                .join('')
            : `
              <div class="empty-state">
                No hay tipos configurados.
              </div>
            `
        }

      </div>
    `;


  $$('.save-type')
    .forEach(
      function (button) {
        button.addEventListener(
          'click',
          async function () {
            const id =
              button.dataset.id;

            const visoria =
              document.querySelector(
                '.type-visoria[data-id="' +
                id +
                '"]'
              );

            const preventivo =
              document.querySelector(
                '.type-preventivo[data-id="' +
                id +
                '"]'
              );

            try {
              await apiCall(
                'adminUpdateUnitType',
                [
                  state.token,

                  id,

                  {
                    frecuenciaVisoriaHoras:
                      Number(
                        visoria.value
                      ),

                    frecuenciaPreventivoDias:
                      Number(
                        preventivo.value
                      )
                  }
                ]
              );

              showToast(
                'Frecuencia actualizada.'
              );

              await refreshAdminSection(
                'types'
              );

            } catch (error) {
              showToast(
                error.message
              );
            }
          }
        );
      }
    );
}


// =========================================================
// ADMIN - CONFIGURACIÓN
// =========================================================

function renderAdminConfig(data) {
  const config =
    Array.isArray(
      data.config
    )
      ? data.config
      : [];

  $('#adminPanel')
    .innerHTML = `

      <div class="section-title">

        <div>

          <h3>
            Configuración general
          </h3>

          <div class="muted">
            Parámetros institucionales de SIGURE.
          </div>

        </div>

      </div>


      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>Parámetro</th>
              <th>Valor</th>
              <th>Descripción</th>
              <th>Acción</th>
            </tr>
          </thead>


          <tbody>

            ${
              config.length
                ? config
                    .map(
                      function (
                        row,
                        index
                      ) {
                        return `
                          <tr>

                            <td>
                              <strong>
                                ${esc(
                                  row.clave
                                )}
                              </strong>
                            </td>

                            <td>
                              <input
                                id="configValue${index}"
                                value="${esc(
                                  row.valor
                                )}"
                              >
                            </td>

                            <td>
                              ${esc(
                                row.descripcion ||
                                ''
                              )}
                            </td>

                            <td>

                              <button
                                type="button"
                                class="button secondary save-config"
                                data-key="${esc(
                                  row.clave
                                )}"
                                data-index="${index}"
                              >
                                Guardar
                              </button>

                            </td>

                          </tr>
                        `;
                      }
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="4">
                      No hay parámetros configurados.
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>
    `;


  $$('.save-config')
    .forEach(
      function (button) {
        button.addEventListener(
          'click',
          async function () {
            const key =
              button.dataset.key;

            const index =
              button.dataset.index;

            const input =
              document.getElementById(
                'configValue' +
                index
              );

            try {
              await apiCall(
                'adminSetConfiguration',
                [
                  state.token,
                  key,
                  input.value
                ]
              );

              showToast(
                'Configuración actualizada.'
              );

              await refreshAdminSection(
                'config'
              );

            } catch (error) {
              showToast(
                error.message
              );
            }
          }
        );
      }
    );
}


// =========================================================
// HELPERS ADMIN
// =========================================================

function adminServiceName(
  id,
  services
) {
  if (!id) {
    return 'Área de Calidad';
  }

  const service =
    services.find(
      function (item) {
        return (
          item.idServicio ===
          id
        );
      }
    );

  return service
    ? service.nombreServicio
    : '-';
}


function adminTypeName(
  id,
  types
) {
  const type =
    types.find(
      function (item) {
        return (
          item.idTipoUnidad ===
          id
        );
      }
    );

  return type
    ? type.nombre
    : '-';
}


function adminTemplateName(
  id,
  templates
) {
  if (!id) {
    return 'Sin plantilla';
  }

  const template =
    templates.find(
      function (item) {
        return (
          item.idPlantilla ===
          id
        );
      }
    );

  return template
    ? (
        template.nombre +
        ' v' +
        template.version
      )
    : '-';
}
