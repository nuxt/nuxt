export default () => ({
  dir: 'dist',
  routes: [],
  exclude: [],
  concurrency: 500,
  ignoreEnv: false,
  interval: 0,
  subFolders: true,
  fallback: '200.html',
  crawler: true,
  manifest: true,
  nojekyll: true,
  cache: {
    ignore: [],
    globbyOptions: {
      gitignore: true
    }
  },
  staticAssets: {
    base: undefined, // Default: "/_nuxt/static:
    versionBase: undefined, // Default: "_nuxt/static/{version}""
    dir: 'static',
    version: undefined // Default: "{timeStampSec}"
  }
})
