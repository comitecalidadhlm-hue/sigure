const state={token:null,user:null,currentView:'dashboard',adminData:null};

document.addEventListener('DOMContentLoaded',function(){bindBaseEvents();restoreSession();});

function $(s){return document.querySelector(s);}
function $$(s){return Array.from(document.querySelectorAll(s));}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmtDate(v){if(!v)return '-';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('es-AR');}
function asBool(v){return v===true||String(v).toLowerCase()==='true'||String(v).toUpperCase()==='VERDADERO';}
function statusBadge(s){let c='warn';if(['OPERATIVA','OPERATIVO','ACTIVO','ACTIVA'].includes(s))c='ok';else if(['NO_OPERATIVA','FUERA_DE_SERVICIO','INACTIVO','INACTIVA'].includes(s))c='danger';else if(s==='EN_REPOSICION')c='info';return `<span class="status ${c}">${esc(s||'-')}</span>`;}
function showToast(m){const ct=$('#toast');if(!ct)return;const t=document.createElement('div');t.className='toast';t.textContent=m;ct.appendChild(t);setTimeout(()=>t.remove(),3500);}
function showLoginMessage(m){const e=$('#loginMessage');if(!e)return;if(!m){e.classList.add('hidden');e.textContent='';return;}e.textContent=m;e.classList.remove('hidden');}
function openModal(h){const m=$('#modal'),b=$('#modalBody');if(!m||!b)return;b.innerHTML=h;m.classList.remove('hidden');}
function closeModal(){const m=$('#modal'),b=$('#modalBody');if(m)m.classList.add('hidden');if(b)b.innerHTML='';}

async function apiCall(action,args=[]){
  const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,args:Array.isArray(args)?args:[]})});
  let p;try{p=await r.json();}catch(e){throw new Error('La API de SIGURE devolvió una respuesta inválida.');}
  if(!r.ok)throw new Error(p.error||`Error HTTP ${r.status}`);
  if(p.ok!==true)throw new Error(p.error||'Error de comunicación con SIGURE.');
  const a=p.result;if(!a)throw new Error('SIGURE no devolvió resultado.');
  if(a.ok!==true)throw new Error(a.error||'La operación no pudo completarse.');
  return a.data;
}

function bindBaseEvents(){
  $('#loginForm')?.addEventListener('submit',onLogin);
  $('#togglePassword')?.addEventListener('click',function(){const i=$('#loginPass');if(!i)return;i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'Ver':'Ocultar';});
  $('#logoutButton')?.addEventListener('click',onLogout);
  $('#refreshButton')?.addEventListener('click',()=>renderView(state.currentView));
  $('#mobileMenuButton')?.addEventListener('click',()=>$('.sidebar')?.classList.toggle('open'));
  $('#modalClose')?.addEventListener('click',closeModal);
  $('[data-close-modal="true"]')?.addEventListener('click',closeModal);
  $$('#nav [data-view]').forEach(b=>b.addEventListener('click',()=>{$('.sidebar')?.classList.remove('open');renderView(b.dataset.view);}));
}

async function onLogin(e){
  e.preventDefault();showLoginMessage('');
  const b=$('#loginButton'),u=$('#loginUser'),p=$('#loginPass');
  if(!b||!u||!p){showLoginMessage('No se pudo inicializar el formulario de acceso.');return;}
  const user=u.value.trim(),pass=p.value;if(!user||!pass){showLoginMessage('Ingrese usuario y contraseña.');return;}
  b.disabled=true;b.textContent='Ingresando...';
  try{const r=await apiCall('login',[user,pass]);if(!r?.token||!r?.user)throw new Error('La sesión recibida desde SIGURE es inválida.');state.token=r.token;state.user=r.user;saveSession();enterApp();await renderView('dashboard');}
  catch(err){showLoginMessage(err.message);}finally{b.disabled=false;b.textContent='Ingresar a SIGURE';}
}

async function onLogout(){try{if(state.token)await apiCall('logout',[state.token]);}catch(e){}clearSession();window.location.reload();}
function saveSession(){sessionStorage.setItem('sigure_token',state.token);sessionStorage.setItem('sigure_user',JSON.stringify(state.user));}
function clearSession(){state.token=null;state.user=null;state.adminData=null;sessionStorage.removeItem('sigure_token');sessionStorage.removeItem('sigure_user');}
async function restoreSession(){const t=sessionStorage.getItem('sigure_token'),u=sessionStorage.getItem('sigure_user');if(!t||!u){showLogin();return;}try{state.token=t;state.user=JSON.parse(u);await apiCall('getDashboard',[state.token]);enterApp();await renderView('dashboard');}catch(e){clearSession();showLogin();}}
function showLogin(){$('#appView')?.classList.add('hidden');$('#loginView')?.classList.remove('hidden');}
function enterApp(){$('#loginView')?.classList.add('hidden');$('#appView')?.classList.remove('hidden');if(!state.user)return;$('#sessionName').textContent=state.user.nombre||state.user.usuario||'Usuario';$('#sidebarRole').textContent=state.user.rol==='CALIDAD'?'Administración institucional':'Gestión del servicio';$('#sessionService').textContent=state.user.rol==='CALIDAD'?'Área de Calidad':'Usuario de servicio';$$('.admin-only').forEach(e=>e.classList.toggle('hidden',state.user.rol!=='CALIDAD'));}

async function renderView(view){
  if(view==='admin'&&state.user?.rol!=='CALIDAD')view='dashboard';state.currentView=view;
  $$('#nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const titles={dashboard:['Panel','Resumen operativo de SIGURE'],units:['Unidades','Carros, mochilas y botiquines asignados'],alerts:['Alertas','Situaciones que requieren atención'],feedback:['Auditorías / Feedback','Devoluciones y seguimiento de Calidad'],admin:['Administración','Configuración institucional']};
  $('#viewTitle').textContent=titles[view][0];$('#viewSubtitle').textContent=titles[view][1];$('#content').innerHTML='<div class="loading-card">Cargando información...</div>';
  try{if(view==='dashboard')return renderDashboard();if(view==='units')return renderUnits();if(view==='alerts')return renderAlerts();if(view==='feedback')return renderFeedback();if(view==='admin')return renderAdmin();}
  catch(e){$('#content').innerHTML=`<div class="empty-state"><strong>No se pudo cargar la información.</strong><p class="muted">${esc(e.message)}</p></div>`;}
}

function metricCard(l,v){return `<div class="card"><div class="metric-label">${esc(l)}</div><div class="metric-value">${esc(v)}</div></div>`;}
async function renderDashboard(){const d=await apiCall('getDashboard',[state.token]),t=d?.totals||{},b=d?.byStatus||{},u=Array.isArray(d?.units)?d.units:[],a=Array.isArray(d?.alerts)?d.alerts:[];$('#content').innerHTML=`<div class="grid metric-grid">${metricCard('Unidades',t.units||0)}${metricCard('Operativas',b.OPERATIVA||0)}${metricCard('En reposición',b.EN_REPOSICION||0)}${metricCard('No operativas',b.NO_OPERATIVA||0)}${metricCard('Alertas abiertas',t.alerts||0)}${metricCard('Feedback pendiente',t.feedbackPending||0)}</div><div class="section-title"><h3>Estado de unidades</h3></div><div class="grid units-grid">${u.length?u.map(unitCard).join(''):'<div class="empty-state">No hay unidades registradas para esta vista.</div>'}</div><div class="section-title"><h3>Alertas prioritarias</h3></div>${alertsTable(a)}`;}
async function renderUnits(){const u=await apiCall('listMyUnits',[state.token]);$('#content').innerHTML=`<div class="grid units-grid">${Array.isArray(u)&&u.length?u.map(unitCard).join(''):'<div class="empty-state">No hay unidades asignadas.</div>'}</div>`;}
function unitCard(u){return `<article class="card unit-card"><div class="unit-head"><div><div class="unit-code">${esc(u.codigo)}</div><div>${esc(u.nombre)}</div></div>${statusBadge(u.estado)}</div><div class="muted">${esc(u.tipoNombre||'')}${u.servicioNombre?' · '+esc(u.servicioNombre):''}</div><div>${esc(u.ubicacion||'Sin ubicación informada')}</div><div class="muted">Próxima acción: <strong>${fmtDate(u.proximaAccion)}</strong></div></article>`;}
async function renderAlerts(){const a=await apiCall('listAlerts',[state.token]);$('#content').innerHTML=alertsTable(Array.isArray(a)?a:[]);}
function alertsTable(a){return `<div class="table-wrap"><table><thead><tr><th>Nivel</th><th>Tipo</th><th>Descripción</th><th>Fecha</th></tr></thead><tbody>${a.length?a.map(x=>`<tr><td>${esc(x.nivel)}</td><td>${esc(x.tipo)}</td><td>${esc(x.descripcion)}</td><td>${fmtDate(x.fechaGeneracion)}</td></tr>`).join(''):'<tr><td colspan="4">Sin alertas abiertas.</td></tr>'}</tbody></table></div>`;}
async function renderFeedback(){const r=await apiCall('listMyAuditFeedback',[state.token]);$('#content').innerHTML=`<div class="grid">${Array.isArray(r)&&r.length?r.map(x=>`<article class="card"><div class="unit-head"><strong>${esc(x.estado||'Feedback')}</strong><span class="muted">${fmtDate(x.fechaEnvio)}</span></div><p>${esc(x.mensajeCalidad||x.descripcion||'')}</p></article>`).join(''):'<div class="empty-state">No hay devoluciones de auditoría pendientes.</div>'}</div>`;}

async function renderAdmin(){if(state.user?.rol!=='CALIDAD')throw new Error('Acceso restringido.');state.adminData=await apiCall('adminGetMasterData',[state.token]);renderAdminHome();}
function renderAdminHome(){const d=state.adminData||{},s=Array.isArray(d.services)?d.services:[],u=Array.isArray(d.users)?d.users:[],n=Array.isArray(d.units)?d.units:[],c=Array.isArray(d.catalog)?d.catalog:[],p=Array.isArray(d.templates)?d.templates:[];$('#content').innerHTML=`<div class="admin-header"><div><h3>Administración institucional</h3><p class="muted">Gestión maestra de SIGURE.</p></div></div><div class="admin-module-grid">${adminModuleCard('Servicios',s.length,'Servicios y áreas asistenciales','services','🏥')}${adminModuleCard('Usuarios',u.length,'Accesos por servicio','users','👤')}${adminModuleCard('Unidades',n.length,'Carros, mochilas y botiquines','units','🚑')}${adminModuleCard('Catálogo',c.length,'Insumos institucionales','catalog','📦')}${adminModuleCard('Plantillas',p.length,'Composición estandarizada','templates','📋')}${adminModuleCard('Configuración','—','Frecuencias y parámetros','config','⚙️')}</div>`;$$('.admin-module-card').forEach(b=>b.addEventListener('click',()=>openAdminSection(b.dataset.section)));}
function adminModuleCard(t,c,d,s,i){return `<button class="admin-module-card" type="button" data-section="${esc(s)}"><div class="admin-module-icon">${i}</div><div><div class="admin-module-title">${esc(t)}</div><div class="admin-module-count">${esc(c)}</div><div class="muted">${esc(d)}</div></div></button>`;}
function openAdminSection(s){if(s==='services')return renderAdminServices();$('#content').innerHTML=`${adminBackHeader('Administración')}<div class="card"><h3>${esc(s)}</h3><p class="muted">Módulo listo para la siguiente etapa.</p></div>`;bindAdminBack();}
function adminBackHeader(t){return `<div class="admin-toolbar"><button id="adminBackButton" class="button secondary" type="button">← Administración</button><h3>${esc(t)}</h3></div>`;}
function bindAdminBack(){$('#adminBackButton')?.addEventListener('click',renderAdminHome);}

function renderAdminServices(){
  const s=Array.isArray(state.adminData?.services)?state.adminData.services:[], activos=s.filter(x=>asBool(x.activo)).length;
  $('#content').innerHTML=`${adminBackHeader('Servicios')}<div class="admin-summary-grid">${metricCard('Servicios registrados',s.length)}${metricCard('Servicios activos',activos)}</div><div class="section-title admin-section-actions"><div><h3>Servicios</h3><p class="muted">Cada servicio mantiene sus usuarios y unidades segregados dentro de SIGURE.</p></div><button id="newServiceButton" class="button primary" type="button">+ Nuevo servicio</button></div><div class="table-wrap"><table><thead><tr><th>Servicio</th><th>Establecimiento</th><th>Estado</th><th>Fecha de creación</th><th>Acciones</th></tr></thead><tbody>${s.length?s.map(serviceRow).join(''):'<tr><td colspan="5">No hay servicios registrados.</td></tr>'}</tbody></table></div>`;
  bindAdminBack();$('#newServiceButton')?.addEventListener('click',openNewServiceModal);
  $$('.edit-service-button').forEach(b=>b.addEventListener('click',()=>{const x=s.find(v=>v.idServicio===b.dataset.id);if(x)openEditServiceModal(x);}));
  $$('.toggle-service-button').forEach(b=>b.addEventListener('click',()=>toggleServiceStatus(b.dataset.id,b.dataset.active==='true')));
}
function serviceRow(s){const a=asBool(s.activo);return `<tr><td><strong>${esc(s.nombreServicio)}</strong><div class="table-id">${esc(s.idServicio)}</div></td><td>${esc(s.establecimiento||'-')}</td><td>${a?statusBadge('ACTIVO'):statusBadge('INACTIVO')}</td><td>${fmtDate(s.fechaCreacion)}</td><td><div class="actions"><button class="button secondary edit-service-button" type="button" data-id="${esc(s.idServicio)}">Editar</button><button class="button ${a?'danger-button':'success-button'} toggle-service-button" type="button" data-id="${esc(s.idServicio)}" data-active="${a}">${a?'Desactivar':'Activar'}</button></div></td></tr>`;}

function openNewServiceModal(){
  openModal(`<h2>Nuevo servicio</h2><p class="muted">Cree un servicio o área asistencial.</p><form id="newServiceForm" class="form-stack"><label>Nombre del servicio<input id="newServiceName" maxlength="150" required placeholder="Ej.: Cuidado Progresivo Amarillo"></label><label>Establecimiento<input id="newServiceFacility" maxlength="150" placeholder="Ej.: Hospital René Favaloro"></label><div class="modal-actions"><button class="button secondary" type="button" id="cancelNewService">Cancelar</button><button class="button primary" type="submit">Crear servicio</button></div></form>`);
  $('#cancelNewService')?.addEventListener('click',closeModal);
  $('#newServiceForm')?.addEventListener('submit',createServiceFromForm);
}
async function createServiceFromForm(e){e.preventDefault();const n=$('#newServiceName').value.trim(),f=$('#newServiceFacility').value.trim();if(!n){showToast('Ingrese el nombre del servicio.');return;}try{await apiCall('adminCreateService',[state.token,{nombreServicio:n,establecimiento:f}]);showToast('Servicio creado correctamente.');closeModal();await refreshAdminData();renderAdminServices();}catch(err){showToast(err.message);}}

function openEditServiceModal(s){
  const a=asBool(s.activo);
  openModal(`<h2>Editar servicio</h2><form id="editServiceForm" class="form-stack"><label>Nombre del servicio<input id="editServiceName" maxlength="150" required value="${esc(s.nombreServicio)}"></label><label>Establecimiento<input id="editServiceFacility" maxlength="150" value="${esc(s.establecimiento||'')}"></label><label>Estado<select id="editServiceActive"><option value="true" ${a?'selected':''}>Activo</option><option value="false" ${!a?'selected':''}>Inactivo</option></select></label><div class="modal-actions"><button class="button secondary" type="button" id="cancelEditService">Cancelar</button><button class="button primary" type="submit">Guardar cambios</button></div></form>`);
  $('#cancelEditService')?.addEventListener('click',closeModal);
  $('#editServiceForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await apiCall('adminUpdateService',[state.token,s.idServicio,{nombreServicio:$('#editServiceName').value.trim(),establecimiento:$('#editServiceFacility').value.trim(),activo:$('#editServiceActive').value==='true'}]);showToast('Servicio actualizado.');closeModal();await refreshAdminData();renderAdminServices();}catch(err){showToast(err.message);}});
}

async function toggleServiceStatus(id,current){const next=!current;if(!window.confirm(next?'¿Desea activar este servicio?':'¿Desea desactivar este servicio?'))return;try{await apiCall('adminUpdateService',[state.token,id,{activo:next}]);showToast(next?'Servicio activado.':'Servicio desactivado.');await refreshAdminData();renderAdminServices();}catch(err){showToast(err.message);}}
async function refreshAdminData(){state.adminData=await apiCall('adminGetMasterData',[state.token]);}

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
