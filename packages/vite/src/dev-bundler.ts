import { pathToFileURL } from 'url'
import * as vite from 'vite'
import { ExternalsOptions, isExternal as _isExternal, ExternalsDefaults } from 'externality'
import { hashId, uniq } from './utils'

export interface TransformChunk {
  id: string,
  code: string,
  deps: string[],
  parents: string[]
}

export interface SSRTransformResult {
  code: string,
  map: object,
  deps: string[]
  dynamicDeps: string[]
}

export interface TransformOptions {
  viteServer: vite.ViteDevServer
}

function isExternal (opts: TransformOptions, id: string) {
  // Externals
  const ssrConfig = (opts.viteServer.config as any).ssr

  const externalOpts: ExternalsOptions = {
    inline: [
      /virtual:/,
      /\.ts$/,
      ...ExternalsDefaults.inline,
      ...ssrConfig.noExternal
    ],
    external: [
      ...ssrConfig.external,
      /node_modules/
    ],
    resolve: {
      type: 'module',
      extensions: ['.ts', '.js', '.json', '.vue', '.mjs', '.jsx', '.tsx', '.wasm']
    }
  }
  return _isExternal(id, opts.viteServer.config.root, externalOpts)
}

async function transformRequest (opts: TransformOptions, id: string) {
  // Virtual modules start with `\0`
  if (id && id.startsWith('/@id/__x00__')) {
    id = '\0' + id.slice('/@id/__x00__'.length)
  }
  if (id && id.startsWith('/@id/')) {
    id = id.slice('/@id/'.length)
  }
  if (id && id.startsWith('/@fs/')) {
    // Absolute path
    id = id.slice('/@fs'.length)
    // On Windows, this may be `/C:/my/path` at this point, in which case we want to remove the `/`
    if (id.match(/^\/\w:/)) {
      id = id.slice(1)
    }
  } else if (!id.includes('entry') && id.startsWith('/')) {
    // Relative to the root directory
    id = '.' + id
  }

  if (await isExternal(opts, id)) {
    return {
      code: `(global, exports, importMeta, ssrImport, ssrDynamicImport, ssrExportAll) => import('${(pathToFileURL(id))}').then(r => { exports.default = r.default; ssrExportAll(r) })`,
      deps: [],
      dynamicDeps: []
    }
  }

  // Transform
  const res: SSRTransformResult = await opts.viteServer.transformRequest(id, { ssr: true }).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn(`[SSR] Error transforming ${id}: ${err}`)
    // console.error(err)
  }) as SSRTransformResult || { code: '', map: {}, deps: [], dynamicDeps: [] }

  // Wrap into a vite module
  const code = `async function (global, __vite_ssr_exports__, __vite_ssr_import_meta__, __vite_ssr_import__, __vite_ssr_dynamic_import__, __vite_ssr_exportAll__) {
${res.code || '/* empty */'};
}`
  return { code, deps: res.deps || [], dynamicDeps: res.dynamicDeps || [] }
}

async function transformRequestRecursive (opts: TransformOptions, id, parent = '<entry>', chunks: Record<string, TransformChunk> = {}) {
  if (chunks[id]) {
    chunks[id].parents.push(parent)
    return
  }
  const res = await transformRequest(opts, id)
  const deps = uniq([...res.deps, ...res.dynamicDeps])

  chunks[id] = {
    id,
    code: res.code,
    deps,
    parents: [parent]
  } as TransformChunk
  for (const dep of deps) {
    await transformRequestRecursive(opts, dep, id, chunks)
  }
  return Object.values(chunks)
}

export async function bundleRequest (opts: TransformOptions, entryURL: string) {
  const chunks = await transformRequestRecursive(opts, entryURL)

  const listIds = (ids: string[]) => ids.map(id => `// - ${id} (${hashId(id)})`).join('\n')
  const chunksCode = chunks.map(chunk => `
// --------------------
// Request: ${chunk.id}
// Parents: \n${listIds(chunk.parents)}
// Dependencies: \n${listIds(chunk.deps)}
// --------------------
const ${hashId(chunk.id)} = ${chunk.code}
`).join('\n')

  const manifestCode = 'const __modules__ = {\n' +
   chunks.map(chunk => ` '${chunk.id}': ${hashId(chunk.id)}`).join(',\n') + '\n}'

  // https://github.com/vitejs/vite/blob/main/packages/vite/src/node/ssr/ssrModuleLoader.ts
  const ssrModuleLoader = `
const __pendingModules__ = new Map()
const __pendingImports__ = new Map()
const __ssrContext__ = { global: globalThis }

function __ssrLoadModule__(url, urlStack = []) {
  const pendingModule = __pendingModules__.get(url)
  if (pendingModule) { return pendingModule }
  const modulePromise = __instantiateModule__(url, urlStack)
  __pendingModules__.set(url, modulePromise)
  modulePromise.catch(() => { __pendingModules__.delete(url) })
         .finally(() => { __pendingModules__.delete(url) })
  return modulePromise
}

async function __instantiateModule__(url, urlStack) {
  const mod = __modules__[url]
  if (mod.stubModule) { return mod.stubModule }
  const stubModule = { [Symbol.toStringTag]: 'Module' }
  Object.defineProperty(stubModule, '__esModule', { value: true })
  mod.stubModule = stubModule
  // https://vitejs.dev/guide/api-hmr.html
  const importMeta = { url, hot: { accept() {}, prune() {}, dispose() {}, invalidate() {}, decline() {}, on() {} } }
  urlStack = urlStack.concat(url)
  const isCircular = url => urlStack.includes(url)
  const pendingDeps = []
  const ssrImport = async (dep) => {
    // TODO: Handle externals if dep[0] !== '.' | '/'
    if (!isCircular(dep) && !__pendingImports__.get(dep)?.some(isCircular)) {
      pendingDeps.push(dep)
      if (pendingDeps.length === 1) {
        __pendingImports__.set(url, pendingDeps)
      }
      await __ssrLoadModule__(dep, urlStack)
      if (pendingDeps.length === 1) {
        __pendingImports__.delete(url)
      } else {
        pendingDeps.splice(pendingDeps.indexOf(dep), 1)
      }
    }
    return __modules__[dep].stubModule
  }
  function ssrDynamicImport (dep) {
    // TODO: Handle dynamic import starting with . relative to url
    return ssrImport(dep)
  }

  function ssrExportAll(sourceModule) {
    for (const key in sourceModule) {
      if (key !== 'default') {
        try {
          Object.defineProperty(stubModule, key, {
            enumerable: true,
            configurable: true,
            get() { return sourceModule[key] }
          })
        } catch (_err) { }
      }
    }
  }

  await mod(
    __ssrContext__.global,
    stubModule,
    importMeta,
    ssrImport,
    ssrDynamicImport,
    ssrExportAll
  )

  return stubModule
}
`

  const code = [
    chunksCode,
    manifestCode,
    ssrModuleLoader,
    `export default await __ssrLoadModule__('${entryURL}')`
  ].join('\n\n')

  return {
    code,
    ids: chunks.map(i => i.id)
  }
}
