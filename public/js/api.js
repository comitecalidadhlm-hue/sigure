/*************************************************
 * SIGURE
 * Sistema Integral de Gestión de Unidades
 * de Respuesta a Emergencias
 *
 * MÓDULO: API
 * Archivo: public/js/api.js
 *************************************************/


// =========================================================
// COMUNICACIÓN CON BACKEND
// =========================================================

async function apiCall(action, args = []) {

  const response = await fetch(
    '/api',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        action: action,

        args: Array.isArray(args)
          ? args
          : []
      })
    }
  );


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


  const apiResult =
    payload.result;


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
