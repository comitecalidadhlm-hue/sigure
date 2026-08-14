/*************************************************
 * SIGURE
 * Frontend Cloudflare
 * public/app.js
 *************************************************/

const state = {
  token: null,
  user: null,
  currentView: 'dashboard'
};


// =========================================================
// INICIO
// =========================================================

document.addEventListener('DOMContentLoaded', function () {

  bindBaseEvents();
  restoreSession();

});


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

  return String(
    value ?? ''
  ).replace(
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

function statusBadge(status) {

  let css = 'warn';

  if (
    [
      'OPERATIVA',
      'OPERATIVO',
      'ACTIVO'
    ].includes(status)
  ) {

    css = 'ok';

  } else if (
    [
      'NO_OPERATIVA',
      'FUERA_DE_SERVICIO',
      'INACTIVO'
    ].includes(status)
  ) {

    css = 'danger';

  } else if (
    status === 'EN_REPOSICION'
  ) {

    css = 'info';

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

    element
      .classList
      .add('hidden');

    element.textContent =
      '';

    return;

  }

  element.textContent =
    message;

  element
    .classList
    .remove('hidden');

}


// =========================================================
// API
// CLOUDFLARE -> APPS SCRIPT
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
          JSON.stringify(
            {
              action:
                action,

              args:
                Array.isArray(args)
                  ? args
                  : []
            }
          )
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


  // Error generado por Cloudflare Worker / ApiHttp.gs
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


  // Error generado por api() de Apps Script
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
// EVENTOS PRINCIPALES
// =========================================================

function bindBaseEvents() {

  const loginForm =
    $('#loginForm');

  const togglePassword =
    $('#togglePassword');

  const logoutButton =
    $('#logoutButton');

  const refreshButton =
    $('#refreshButton');

  const mobileMenuButton =
    $('#mobileMenuButton');

  const modalClose =
    $('#modalClose');

  const modalBackdrop =
    $('[data-close-modal="true"]');


  // LOGIN
  if (loginForm) {

    loginForm
      .addEventListener(
        'submit',
        onLogin
      );

  }


  // VER / OCULTAR CONTRASEÑA
  if (togglePassword) {

    togglePassword
      .addEventListener(
        'click',
        function () {

          const input =
            $('#loginPass');

          if (!input) {
            return;
          }


          if (
            input.type ===
            'password'
          ) {

            input.type =
              'text';

            this.textContent =
              'Ocultar';

          } else {

            input.type =
              'password';

            this.textContent =
              'Ver';

          }

        }
      );

  }


  // LOGOUT
  if (logoutButton) {

    logoutButton
      .addEventListener(
        'click',
        onLogout
      );

  }


  // ACTUALIZAR VISTA
  if (refreshButton) {

    refreshButton
      .addEventListener(
        'click',
        function () {

          renderView(
            state.currentView
          );

        }
      );

  }


  // MENÚ MÓVIL
  if (mobileMenuButton) {

    mobileMenuButton
      .addEventListener(
        'click',
        function () {

          const sidebar =
            $('.sidebar');

          if (sidebar) {

            sidebar
              .classList
              .toggle(
                'open'
              );

          }

        }
      );

  }


  // CERRAR MODAL
  if (modalClose) {

    modalClose
      .addEventListener(
        'click',
        closeModal
      );

  }


  if (modalBackdrop) {

    modalBackdrop
      .addEventListener(
        'click',
        closeModal
      );

  }


  // NAVEGACIÓN
  $$('#nav [data-view]')
    .forEach(
      function (button) {

        button
          .addEventListener(
            'click',
            function () {

              const sidebar =
                $('.sidebar');

              if (sidebar) {

                sidebar
                  .classList
                  .remove(
                    'open'
                  );

              }


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


  showLoginMessage(
    ''
  );


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
      'No se pudo inicializar el formulario de acceso.'
    );

    return;

  }


  const usuario =
    userInput
      .value
      .trim();

  const password =
    passwordInput
      .value;


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

    if (state.token) {

      await apiCall(
        'logout',
        [
          state.token
        ]
      );

    }

  } catch (error) {

    console.warn(
      'No se pudo cerrar la sesión remota:',
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


    // Validamos que la sesión continúe vigente
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

  const appView =
    $('#appView');

  const loginView =
    $('#loginView');


  if (appView) {

    appView
      .classList
      .add(
        'hidden'
      );

  }


  if (loginView) {

    loginView
      .classList
      .remove(
        'hidden'
      );

  }

}

function enterApp() {

  const loginView =
    $('#loginView');

  const appView =
    $('#appView');


  if (loginView) {

    loginView
      .classList
      .add(
        'hidden'
      );

  }


  if (appView) {

    appView
      .classList
      .remove(
        'hidden'
      );

  }


  if (!state.user) {
    return;
  }


  const sessionName =
    $('#sessionName');

  const sidebarRole =
    $('#sidebarRole');

  const sessionService =
    $('#sessionService');


  if (sessionName) {

    sessionName.textContent =
      state.user.nombre ||
      state.user.usuario ||
      'Usuario';

  }


  if (sidebarRole) {

    sidebarRole.textContent =
      state.user.rol ===
        'CALIDAD'
        ?
        'Administración institucional'
        :
        'Gestión del servicio';

  }


  if (sessionService) {

    sessionService.textContent =
      state.user.rol ===
        'CALIDAD'
        ?
        'Área de Calidad'
        :
        'Usuario de servicio';

  }


  $$('.admin-only')
    .forEach(
      function (element) {

        element
          .classList
          .toggle(
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

  const allowedViews = [
    'dashboard',
    'units',
    'alerts',
    'feedback',
    'admin'
  ];


  if (
    !allowedViews.includes(
      view
    )
  ) {

    view =
      'dashboard';

  }


  if (
    view === 'admin' &&
    state.user &&
    state.user.rol !== 'CALIDAD'
  ) {

    view =
      'dashboard';

  }


  state.currentView =
    view;


  $$('#nav [data-view]')
    .forEach(
      function (button) {

        button
          .classList
          .toggle(
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


  const viewTitle =
    $('#viewTitle');

  const viewSubtitle =
    $('#viewSubtitle');

  const content =
    $('#content');


  if (viewTitle) {

    viewTitle.textContent =
      titles[view][0];

  }


  if (viewSubtitle) {

    viewSubtitle.textContent =
      titles[view][1];

  }


  if (content) {

    content.innerHTML =
      '<div class="loading-card">Cargando información...</div>';

  }


  try {

    if (
      view ===
      'dashboard'
    ) {

      await renderDashboard();

      return;

    }


    if (
      view ===
      'units'
    ) {

      await renderUnits();

      return;

    }


    if (
      view ===
      'alerts'
    ) {

      await renderAlerts();

      return;

    }


    if (
      view ===
      'feedback'
    ) {

      await renderFeedback();

      return;

    }


    if (
      view ===
      'admin'
    ) {

      renderAdminEntry();

      return;

    }


  } catch (error) {

    if (content) {

      content.innerHTML = `
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
    dashboard &&
    dashboard.totals
      ?
      dashboard.totals
      :
      {};


  const byStatus =
    dashboard &&
    dashboard.byStatus
      ?
      dashboard.byStatus
      :
      {};


  const units =
    dashboard &&
    Array.isArray(
      dashboard.units
    )
      ?
      dashboard.units
      :
      [];


  const alerts =
    dashboard &&
    Array.isArray(
      dashboard.alerts
    )
      ?
      dashboard.alerts
      :
      [];


  const content =
    $('#content');


  if (!content) {
    return;
  }


  content.innerHTML = `

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
          ?
          units
            .map(
              unitCard
            )
            .join('')
          :
          `
            <div class="empty-state">
              No hay unidades registradas para esta vista.
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


  const content =
    $('#content');


  if (!content) {
    return;
  }


  content.innerHTML = `

    <div class="grid units-grid">

      ${
        Array.isArray(units) &&
        units.length
          ?
          units
            .map(
              unitCard
            )
            .join('')
          :
          `
            <div class="empty-state">
              No hay unidades asignadas.
            </div>
          `
      }

    </div>
  `;

}

function unitCard(unit) {

  return `

    <article class="card unit-card">

      <div class="unit-head">

        <div>

          <div class="unit-code">
            ${esc(unit.codigo)}
          </div>

          <div>
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
            ?
            ' · ' +
            esc(
              unit.servicioNombre
            )
            :
            ''
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

    </article>
  `;

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


  const content =
    $('#content');


  if (!content) {
    return;
  }


  content.innerHTML =
    alertsTable(
      Array.isArray(alerts)
        ?
        alerts
        :
        []
    );

}

function alertsTable(alerts) {

  return `

    <div class="table-wrap">

      <table>

        <thead>

          <tr>

            <th>
              Nivel
            </th>

            <th>
              Tipo
            </th>

            <th>
              Descripción
            </th>

            <th>
              Fecha
            </th>

          </tr>

        </thead>


        <tbody>

          ${
            alerts.length
              ?
              alerts
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
              :
              `
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
// AUDITORÍA / FEEDBACK
// =========================================================

async function renderFeedback() {

  const rows =
    await apiCall(
      'listMyAuditFeedback',
      [
        state.token
      ]
    );


  const content =
    $('#content');


  if (!content) {
    return;
  }


  content.innerHTML = `

    <div class="grid">

      ${
        Array.isArray(rows) &&
        rows.length
          ?
          rows
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
                        ?
                        `

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
                        :
                        ''
                    }

                  </article>
                `;

              }
            )
            .join('')
          :
          `
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

function renderAdminEntry() {

  const content =
    $('#content');


  if (!content) {
    return;
  }


  content.innerHTML = `

    <div class="card">

      <h3>
        Administración institucional
      </h3>

      <p class="muted">

        La conexión con el backend está activa.

        En la siguiente etapa incorporaremos:

        Servicios,
        Usuarios,
        Unidades,
        Catálogo,
        Plantillas,
        Frecuencias
        y Configuración.

      </p>

    </div>
  `;

}


// =========================================================
// MODAL
// =========================================================

function closeModal() {

  const modal =
    $('#modal');

  const modalBody =
    $('#modalBody');


  if (modal) {

    modal
      .classList
      .add(
        'hidden'
      );

  }


  if (modalBody) {

    modalBody.innerHTML =
      '';

  }

}
