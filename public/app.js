document
  .getElementById('testApi')
  .addEventListener('click', function () {

    const result =
      document.getElementById('result');

    result.textContent =
      'SIGURE está funcionando correctamente desde Cloudflare.';

  });
