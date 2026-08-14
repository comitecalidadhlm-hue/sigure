const state = { token:null, user:null, currentView:'dashboard' };

document.addEventListener('DOMContentLoaded', function () {
  bindBaseEvents();
  restoreSession();
});

function $(s){ return document.querySelector(s); }
function $$(s){ return Array.from(document.querySelectorAll(s)); }
function esc(v){ return String(v ?? '').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function fmtDate(v){ if(!v)return '-'; const d=new Date(v); return Number.isNaN(d.getTime())?String(v):d.toLocaleString('es-AR'); }

function statusBadge(status){
  let css='warn';
  if(['OPERATIVA','OPERATIVO','ACTIVO'].includes(status)) css='ok';
  else if(['NO_OPERATIVA','FUERA_DE_SERVICIO','INACTIVO'].includes(status)) css='danger';
  else if(status==='EN_REPOSICION') css='info';
  return `<span class="status ${css}">${esc(status || '-')}</span>`;
}

function showToast(message){
  const t=document.createElement('div'); t.className='toast'; t.textContent=message; $('#toast').appendChild(t);
  setTimeout(()=>t.remove(),3500);
}
function showLoginMessage(message){
  const e=$('#loginMessage');
  if(!message){e.classList.add('hidden');e.textContent='';return;}
  e.textContent=message;e.classList.remove('hidden');
}

async function apiCall(action,args=[]){
  const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,args:Array.isArray(args)?args:[]})});
  let payload;
  try{payload=await response.json();}catch(e){throw new Error('La API de SIGURE devolvió una respuesta inválida.');}
  if(!response.ok) throw new Error(payload.error || `Error HTTP ${response.status}`);
  if(payload.ok!==true) throw new Error(payload.error || 'Error de comunicación con SIGURE.');
  const apiResult=payload.result;
  if(!apiResult) throw new Error('SIGURE no devolvió resultado.');
  if(apiResult.ok!==true) throw new Error(apiResult.error || 'La operación no pudo completarse.');
  return apiResult.data;
}

function bindBaseEvents(){
  $('#loginForm').addEventListener('submit',onLogin);
  $('#togglePassword').addEventListener('click',function(){
    const i=$('#loginPass'); i.type=i.type==='password'?'text':'password'; this.textContent=i.type==='password'?'Ver':'Ocultar';
  });
  $('#logoutButton').addEventListener('click',onLogout);
  $('#refreshButton').addEventListener('click',()=>renderView(state.currentView));
  $('#mobileMenuButton').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));
  $('#modalClose').addEventListener('click',closeModal);
  $('[data-close-modal="true"]').addEventListener('click',closeModal);
  $$('#nav [data-view]').forEach(b=>b.addEventListener('click',()=>{ $('.sidebar').classList.remove('open'); renderView(b.dataset.view); }));
}

async function onLogin(event){
  event.preventDefault(); showLoginMessage('');
  const button=$('#loginButton'), usuario=$('#loginUser').value.trim(), password=$('#loginPass').value;
  if(!usuario || !password){showLoginMessage('Ingrese usuario y contraseña.');return;}
  button.disabled=true;button.textContent='Ingresando...';
  try{
    const result=await apiCall('login',[usuario,password]);
    if(!result?.token || !result?.user) throw new Error('La sesión recibida desde SIGURE es inválida.');
    state.token=result.token;state.user=result.user;saveSession();enterApp();await renderView('dashboard');
  }catch(error){showLoginMessage(error.message);}
  finally{button.disabled=false;button.textContent='Ingresar a SIGURE';}
}

async function onLogout(){
  try{if(state.token) await apiCall('logout',[state.token]);}catch(e){}
  clearSession();window.location.reload();
}

function saveSession(){sessionStorage.setItem('sigure_token',state.token);sessionStorage.setItem('sigure_user',JSON.stringify(state.user));}
function clearSession(){state.token=null;state.user=null;sessionStorage.removeItem('sigure_token');sessionStorage.removeItem('sigure_user');}

async function restoreSession(){
  const token=sessionStorage.getItem('sigure_token'), raw=sessionStorage.getItem('sigure_user');
  if(!token || !raw){showLogin();return;}
  try{
    state.token=token;state.user=JSON.parse(raw);
    await apiCall('getDashboard',[state.token]);
    enterApp();await renderView('dashboard');
  }catch(e){clearSession();showLogin();}
}

function showLogin(){$('#appView').classList.add('hidden');$('#loginView').classList.remove('hidden');}
function enterApp(){
  $('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');
  $('#sessionName').textContent=state.user.nombre || state.user.usuario || 'Usuario';
  $('#sidebarRole').textContent=state.user.rol==='CALIDAD'?'Administración institucional':'Gestión del servicio';
  $('#sessionService').textContent=state.user.rol==='CALIDAD'?'Área de Calidad':'Usuario de servicio';
  $$('.admin-only').forEach(el=>el.classList.toggle('hidden',state.user.rol!=='CALIDAD'));
}

async function renderView(view){
  if(view==='admin' && state.user.rol!=='CALIDAD') view='dashboard';
  state.currentView=view;
  $$('#nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const titles={dashboard:['Panel','Resumen operativo de SIGURE'],units:['Unidades','Carros, mochilas y botiquines asignados'],alerts:['Alertas','Situaciones que requieren atención'],feedback:['Auditorías / Feedback','Devoluciones y seguimiento de Calidad'],admin:['Administración','Configuración institucional']};
  $('#viewTitle').textContent=titles[view][0];$('#viewSubtitle').textContent=titles[view][1];
  $('#content').innerHTML='<div class="loading-card">Cargando información...</div>';
  try{
    if(view==='dashboard') return await renderDashboard();
    if(view==='units') return await renderUnits();
    if(view==='alerts') return await renderAlerts();
    if(view==='feedback') return await renderFeedback();
    if(view==='admin') return renderAdminEntry();
  }catch(error){
    $('#content').innerHTML=`<div class="empty-state"><strong>No se pudo cargar la información.</strong><p class="muted">${esc(error.message)}</p></div>`;
  }
}

function metricCard(label,value){return `<div class="card"><div class="metric-label">${esc(label)}</div><div class="metric-value">${esc(value)}</div></div>`;}

async function renderDashboard(){
  const d=await apiCall('getDashboard',[state.token]);
  const totals=d?.totals||{}, by=d?.byStatus||{}, units=Array.isArray(d?.units)?d.units:[], alerts=Array.isArray(d?.alerts)?d.alerts:[];
  $('#content').innerHTML=`
    <div class="grid metric-grid">
      ${metricCard('Unidades',totals.units||0)}
      ${metricCard('Operativas',by.OPERATIVA||0)}
      ${metricCard('En reposición',by.EN_REPOSICION||0)}
      ${metricCard('No operativas',by.NO_OPERATIVA||0)}
      ${metricCard('Alertas abiertas',totals.alerts||0)}
      ${metricCard('Feedback pendiente',totals.feedbackPending||0)}
    </div>
    <div class="section-title"><h3>Estado de unidades</h3></div>
    <div class="grid units-grid">${units.length?units.map(unitCard).join(''):'<div class="empty-state">No hay unidades registradas para esta vista.</div>'}</div>
    <div class="section-title"><h3>Alertas prioritarias</h3></div>
    ${alertsTable(alerts)}`;
}

async function renderUnits(){
  const units=await apiCall('listMyUnits',[state.token]);
  $('#content').innerHTML=`<div class="grid units-grid">${Array.isArray(units)&&units.length?units.map(unitCard).join(''):'<div class="empty-state">No hay unidades asignadas.</div>'}</div>`;
}

function unitCard(u){
  return `<article class="card unit-card"><div class="unit-head"><div><div class="unit-code">${esc(u.codigo)}</div><div>${esc(u.nombre)}</div></div>${statusBadge(u.estado)}</div><div class="muted">${esc(u.tipoNombre||'')}${u.servicioNombre?' · '+esc(u.servicioNombre):''}</div><div>${esc(u.ubicacion||'Sin ubicación informada')}</div><div class="muted">Próxima acción: <strong>${fmtDate(u.proximaAccion)}</strong></div></article>`;
}

async function renderAlerts(){const a=await apiCall('listAlerts',[state.token]);$('#content').innerHTML=alertsTable(Array.isArray(a)?a:[]);}
function alertsTable(a){return `<div class="table-wrap"><table><thead><tr><th>Nivel</th><th>Tipo</th><th>Descripción</th><th>Fecha</th></tr></thead><tbody>${a.length?a.map(x=>`<tr><td>${esc(x.nivel)}</td><td>${esc(x.tipo)}</td><td>${esc(x.descripcion)}</td><td>${fmtDate(x.fechaGeneracion)}</td></tr>`).join(''):'<tr><td colspan="4">Sin alertas abiertas.</td></tr>'}</tbody></table></div>`;}

async function renderFeedback(){
  const rows=await apiCall('listMyAuditFeedback',[state.token]);
  $('#content').innerHTML=`<div class="grid">${Array.isArray(rows)&&rows.length?rows.map(r=>`<article class="card"><div class="unit-head"><strong>${esc(r.estado||'Feedback')}</strong><span class="muted">${fmtDate(r.fechaEnvio)}</span></div><p>${esc(r.mensajeCalidad||r.descripcion||'')}</p>${r.respuestaServicio?`<div class="loading-card"><strong>Respuesta del servicio</strong><p>${esc(r.respuestaServicio)}</p></div>`:''}</article>`).join(''):'<div class="empty-state">No hay devoluciones de auditoría pendientes.</div>'}</div>`;
}

function renderAdminEntry(){
  $('#content').innerHTML=`<div class="card"><h3>Administración institucional</h3><p class="muted">La conexión con el backend está activa. En la siguiente etapa incorporaremos Servicios, Usuarios, Unidades, Catálogo, Plantillas, Frecuencias y Configuración.</p></div>`;
}

function closeModal(){$('#modal').classList.add('hidden');$('#modalBody').innerHTML='';}

      });

      const text = await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch (error) {
        result.textContent =
          'La API respondió, pero no devolvió JSON válido:\n\n' +
          text;
        return;
      }

      result.textContent =
        JSON.stringify(data, null, 2);

    } catch (error) {

      result.textContent =
        'ERROR DE CONEXIÓN:\n' +
        error.message;

    }

  });
