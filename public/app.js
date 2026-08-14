document
  .getElementById('testApi')
  .addEventListener('click', async function () {

    const result = document.getElementById('result');

    result.textContent =
      'Conectando con el backend de SIGURE...';

    try {

      const response = await fetch('/api', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          action: 'login',
          args: [
            'usuario_inexistente',
            'password_inexistente'
          ]
        })
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
