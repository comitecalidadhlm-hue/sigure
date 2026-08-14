/*************************************************
 * SIGURE
 * Cloudflare frontend
 * public/app.js
 * Administración > Servicios
 *************************************************/

const state = {
  token: null,
  user: null,
  currentView: 'dashboard',
  adminData: null
};

document.addEventListener('DOMContentLoaded', function () {
  bindBaseEvents();
  restoreSession();
});

function $(s) {
  return document.querySelector(s);
}

function $$(s) {
  return Array.from(document.querySelectorAll(s));
}

function esc(v) {
  return String(v ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );
}

function fmtDate(v) {
  if (!v) return '-';

  const d = new Date(v);

  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString('es-AR');
}

function asBool(v) {
  return (
    v === true ||
    String(v).toLowerCase() === 'true' ||
    String(v).toUpperCase() === 'VERDADERO'
  );
}

function statusBadge(status) {
  let css = 'warn';

  if (
    ['OPERATIVA', 'OPERATIVO', 'ACTIVO', 'ACTIVA'].includes(status)
  ) {
    css = 'ok';
  } else if (
    [
      'NO_OPERATIVA',
      'FUERA_DE_SERVICIO',
      'INACTIVO',
      'INACTIVA'
    ].includes(status)
  ) {
    css = 'danger';
  } else if (status === 'EN_REPOSICION') {
    css = 'info';
  }

  return `
    <span class="status ${css}">
      ${esc(status || '-')}
    </span>
  `;
}

function showToast(message) {
  const container = $('#toast');

  if (!container) {
    alert(message);
    return;
  }

  const toast = document.createElement('div');

  toast.className = 'toast';
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(function () {
    toast.remove();
  }, 3500);
}

function showLoginMessage(message) {
  const element = $('#loginMessage');

  if (!element) return;

  if (!message) {
    element.classList.add('hidden');
    element.textContent = '';
    return;
  }

  element.textContent = message;
  element.classList.remove('hidden');
}

function openModal(html) {
  const modal = $('#modal');
  const body = $('#modalBody');

  if (!modal || !body) return;

  body.innerHTML = html;
  modal.classList.remove('hidden');
}

function closeModal() {
  const modal = $('#modal');
  const body = $('#modalBody');

  if (modal) {
    modal.classList.add('hidden');
  }

  if (body) {
    body.innerHTML = '';
  }
}


// =========================================================
// API
// =========================================================

async function apiCall(action, args = []) {
  const response = await fetch('/api', {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      action: action,
      args: Array.isArray(args) ? args : []
    })
  });

  let payload;

  try {
    payload = await response.json();
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

  if (payload.ok !== true) {
    throw new Error(
      payload.error ||
      'Error de comunicación con SIGURE.'
    );
  }

  const apiResult = payload.result;

  if (!apiResult) {
    throw new Error(
      'SIGURE no devolvió resultado.'
    );
  }

  if (apiResult.ok !== true) {
    throw new Error(
      apiResult.error ||
      'La operación no pudo completarse.'
    );
  }

  return apiResult.data;
}


// =========================================================
// EVENTOS
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
        const input = $('#loginPass');

        if (!input) return;

        input.type =
          input.type === 'password'
            ? 'text'
            : 'password';

        this.textContent =
          input.type === 'password'
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
          .toggle('open');
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
    .forEach(function (button) {
      button.addEventListener(
        'click',
        function () {
          $('.sidebar')
            ?.classList
            .remove('open');

          renderView(
            button.dataset.view
          );
        }
      );
    });
}


// =========================================================
// LOGIN
// =========================================================

async function onLogin(event) {
  event.preventDefault();

  showLoginMessage('');

  const button = $('#loginButton');

  const usuario =
    $('#loginUser')
      .value
      .trim();

  const password =
    $('#loginPass')
      .value;

  if (!usuario || !password) {
    showLoginMessage(
      'Ingrese usuario y contraseña.'
    );

    return;
  }

  button.disabled = true;
  button.textContent = 'Ingresando...';

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

    state.token = result.token;
    state.user = result.user;

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
    button.disabled = false;

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
        [state.token]
      );
    }
  } catch (error) {
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
  state.token = null;
  state.user = null;
  state.adminData = null;

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

  if (!token || !rawUser) {
    showLogin();
    return;
  }

  try {
    state.token = token;

    state.user =
      JSON.parse(
        rawUser
      );

    await apiCall(
      'getDashboard',
      [state.token]
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
    .add('hidden');

  $('#loginView')
    ?.classList
    .remove('hidden');
}

function enterApp() {
  $('#loginView')
    ?.classList
    .add('hidden');

  $('#appView')
    ?.classList
    .remove('hidden');

  if (!state.user) return;

  $('#sessionName').textContent =
    state.user.nombre ||
    state.user.usuario ||
    'Usuario';

  $('#sidebarRole').textContent =
    state.user.rol === 'CALIDAD'
      ? 'Administración institucional'
      : 'Gestión del servicio';

  $('#sessionService').textContent =
    state.user.rol === 'CALIDAD'
      ? 'Área de Calidad'
      : 'Usuario de servicio';

  $$('.admin-only')
    .forEach(function (element) {
      element.classList.toggle(
        'hidden',
        state.user.rol !==
          'CALIDAD'
      );
    });
}


// =========================================================
// NAVEGACIÓN
// =========================================================

async function renderView(view) {
  if (
    view === 'admin' &&
    state.user.rol !==
      'CALIDAD'
  ) {
    view = 'dashboard';
  }

  state.currentView = view;

  $$('#nav [data-view]')
    .forEach(function (button) {
      button.classList.toggle(
        'active',
        button.dataset.view ===
          view
      );
    });

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

  $('#viewTitle').textContent =
    titles[view][0];

  $('#viewSubtitle').textContent =
    titles[view][1];

  $('#content').innerHTML =
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
    $('#content').innerHTML = `
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
  const d =
    await apiCall(
      'getDashboard',
      [state.token]
    );

  const totals =
    d?.totals || {};

  const by =
    d?.byStatus || {};

  const units =
    Array.isArray(d?.units)
      ? d.units
      : [];

  const alerts =
    Array.isArray(d?.alerts)
      ? d.alerts
      : [];

  $('#content').innerHTML = `

    <div class="grid metric-grid">

      ${metricCard(
        'Unidades',
        totals.units || 0
      )}

      ${metricCard(
        'Operativas',
        by.OPERATIVA || 0
      )}

      ${metricCard(
        'En reposición',
        by.EN_REPOSICION || 0
      )}

      ${metricCard(
        'No operativas',
        by.NO_OPERATIVA || 0
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
              .map(unitCard)
              .join('')
          : `
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
      [state.token]
    );

  $('#content').innerHTML = `

    <div class="grid units-grid">

      ${
        Array.isArray(units) &&
        units.length
          ? units
              .map(unitCard)
              .join('')
          : `
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
      [state.token]
    );

  $('#content').innerHTML =
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
                  .map(function (alert) {
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
                  })
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
      [state.token]
    );

  $('#content').innerHTML = `

    <div class="grid">

      ${
        Array.isArray(rows) &&
        rows.length
          ? rows
              .map(function (row) {
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
              })
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
      [state.token]
    );

  state.adminData = data;

  $('#content').innerHTML = `

    <div class="admin-tabs">

      <button
        class="admin-tab active"
        data-admin-tab="services">

        Servicios

      </button>


      <button
        class="admin-tab"
        data-admin-tab="users">

        Usuarios

      </button>


      <button
        class="admin-tab"
        data-admin-tab="units">

        Unidades

      </button>


      <button
        class="admin-tab"
        data-admin-tab="catalog">

        Catálogo

      </button>


      <button
        class="admin-tab"
        data-admin-tab="templates">

        Plantillas

      </button>


      <button
        class="admin-tab"
        data-admin-tab="types">

        Frecuencias

      </button>


      <button
        class="admin-tab"
        data-admin-tab="config">

        Configuración

      </button>

    </div>


    <div id="adminPanel"></div>
  `;

  $$('.admin-tab')
    .forEach(function (button) {
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
            button.dataset.adminTab,
            data
          );
        }
      );
    });

  renderAdminSection(
    'services',
    data
  );
}

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

  const names = {
    users: 'Usuarios',
    units: 'Unidades',
    catalog: 'Catálogo',
    templates: 'Plantillas',
    types: 'Frecuencias',
    config: 'Configuración'
  };

  $('#adminPanel').innerHTML = `

    <div class="card">

      <h3>
        ${esc(
          names[section] ||
          section
        )}
      </h3>

      <p class="muted">
        Este módulo será incorporado en la siguiente etapa.
      </p>

    </div>
  `;
}


// =========================================================
// ADMINISTRACIÓN > SERVICIOS
// =========================================================

function renderAdminServices(data) {
  const services =
    Array.isArray(
      data.services
    )
      ? data.services
      : [];

  $('#adminPanel').innerHTML = `

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
        id="newServiceButton"
        class="button primary">

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
                              class="button secondary edit-service"
                              data-id="${esc(
                                service.idServicio
                              )}">

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


  $('#newServiceButton')
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


            if (service) {

              openEditService(
                service
              );

            }

          }
        );

      }
    );
}


// =========================================================
// NUEVO SERVICIO
// =========================================================

function openNewService() {

  openModal(`

    <h2>
      Nuevo servicio
    </h2>


    <form
      id="serviceForm"
      class="form-stack">


      <label>

        Nombre del servicio

        <input
          id="svcName"
          required>

      </label>


      <label>

        Establecimiento

        <input
          id="svcSite">

      </label>


      <button
        type="submit"
        class="button primary">

        Crear servicio

      </button>

    </form>
  `);


  $('#serviceForm')
    .addEventListener(
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


          await renderAdmin();


        } catch (error) {

          showToast(
            error.message
          );

        }

      }
    );
}


// =========================================================
// EDITAR SERVICIO
// =========================================================

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
      class="form-stack">


      <label>

        Servicio

        <input
          id="editServiceName"
          value="${esc(
            service.nombreServicio
          )}"
          required>

      </label>


      <label>

        Establecimiento

        <input
          id="editServiceSite"
          value="${esc(
            service.establecimiento ||
            ''
          )}">

      </label>


      <label>

        Estado

        <select
          id="editServiceActive">


          <option
            value="true"
            ${
              active
                ? 'selected'
                : ''
            }>

            Activo

          </option>


          <option
            value="false"
            ${
              !active
                ? 'selected'
                : ''
            }>

            Inactivo

          </option>


        </select>

      </label>


      <button
        type="submit"
        class="button primary">

        Guardar cambios

      </button>

    </form>
  `);


  $('#editServiceForm')
    .addEventListener(
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


          await renderAdmin();


        } catch (error) {

          showToast(
            error.message
          );

        }

      }
    );
}
