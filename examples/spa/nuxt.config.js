module.exports = {
  /*
  ** Single Page Application mode
  ** Means no SSR
  */
  mode: 'spa',
  /*
  ** Add css for appear transition
  */
  css: ['~/assets/main.css'],
  /*
  ** Cutomize loading indicator
  */
  loadingIndicator: {
    /*
    ** See https://github.com/nuxt/nuxt.js/tree/dev/lib/app/views/loading for available loading indicators
    ** You can add a custom indicator by giving a path
    ** Default: 'circle'
    */
    name: 'folding-cube',
    /*
    ** You can give custom options given to the template
    ** See https://github.com/nuxt/nuxt.js/blob/dev/lib/app/views/loading/folding-cube.html
    ** Default:
    ** - color: '#3B8070'
    ** - background: 'white'
    */
    color: '#222',
    background: 'white'
  }
}
