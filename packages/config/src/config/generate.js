
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
    base: undefined, // Default: "/_nuxt/static:
    versionBase: undefined, // Default: "_nuxt/static/{version}""
    dir: 'static',
    version: undefined // Default: "{timeStampSec}"
  }
})
