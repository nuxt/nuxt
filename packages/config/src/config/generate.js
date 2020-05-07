
export default () => ({
  dir: 'dist',
  routes: [],
  exclude: [],
  concurrency: 500,
  interval: 0,
  subFolders: true,
  fallback: '200.html',
  crawler: true,
  staticAssets: {
    base: undefined, // /_nuxt/static
    versionBase: undefined, // _nuxt/static/{version}
    dir: 'static',
    version: String(Math.round(Date.now() / 1000))
  }
})
