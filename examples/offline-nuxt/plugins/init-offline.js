if (process.BROWSER_BUILD && process.env.NODE_ENV === 'production') {
  require('offline-plugin/runtime').install()
  window.onNuxtReady((app) => {
    if ('serviceWorker' in navigator) {
      if (navigator.serviceWorker.controller) {} else {
        navigator.serviceWorker.register('/_nuxt/tcmpsw.js', {scope: '/'}).then(function(res) {
          console.log('sw loaded...')
        }).catch(function(err) {
          console.log(err);
        });
      }
    } else if (window.applicationCache) {
      // register appcache code
      var iframe = document.createElement('iframe');
      iframe.style.display = "none";
      iframe.src = '/_nuxt/appcache/manifest.html';
      document.body.appendChild(iframe);
    }
  })
}
