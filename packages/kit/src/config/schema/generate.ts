import { resolve } from 'path'
import { joinURL } from 'ufo'

export default {
  dir: {
    $resolve: (val = 'dist', get) => resolve(get('rootDir'), val)
  },
  routes: [],
  exclude: [],
  concurrency: 500,
  interval: 0,
  subFolders: true,
  fallback: { $resolve: val => val === true ? '400.html' : (val || '200.html') },
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
    dir: 'static',
    base: { $resolve: (val, get) => val || joinURL(get('app.assetsPath'), get('generate.dir')) },
    versionBase: { $resolve: (val, get) => val || joinURL(get('generate.base'), get('generate.version')) },
    version: { $resolve: val => val || (String(Math.round(Date.now() / 1000))) }
  }
}
