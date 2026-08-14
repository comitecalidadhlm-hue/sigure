export default {

  async fetch(request, env) {

    const url = new URL(request.url);

    // ==========================================
    // API SIGURE
    // ==========================================

    if (url.pathname === '/api') {

      if (request.method !== 'POST') {

        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Método no permitido.'
          }),
          {
            status: 405,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

      }


      if (!env.APPS_SCRIPT_URL) {

        return new Response(
          JSON.stringify({
            ok: false,
            error: 'APPS_SCRIPT_URL no configurada.'
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

      }


      try {

        const body = await request.text();

        const response = await fetch(
          env.APPS_SCRIPT_URL,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json'
            },

            body: body
          }
        );


        const text = await response.text();


        return new Response(
          text,
          {
            status: response.status,

            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store'
            }
          }
        );


      } catch (error) {

        return new Response(
          JSON.stringify({
            ok: false,
            error: error.message || String(error)
          }),
          {
            status: 500,

            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

      }

    }


    // ==========================================
    // ARCHIVOS ESTÁTICOS
    // ==========================================

    return env.ASSETS.fetch(request);

  }

};
