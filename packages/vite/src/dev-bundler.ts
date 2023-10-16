import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { isAbsolute, normalize, resolve } from 'pathe'
import type * as vite from 'vite'
import type { isExternal } from 'externality'
import { genDynamicImport, genObjectFromRawEntries } from 'knitwork'
import fse from 'fs-extra'
import { debounce } from 'perfect-debounce'
import { isIgnored, logger } from '@nuxt/kit'
import { hashId, isCSS, uniq } from './utils'
import { createIsExternal } from './utils/external'
import { writeManifest } from './manifest'
import type { ViteBuildContext } from './vite'

interface TransformChunk {
  id: string,
  code: string,
  deps: string[],
  parents: string[]
}

interface SSRTransformResult {
  code: string,
  map: object,
  deps: string[]
  dynamicDeps: string[]
}

interface TransformOptions {
  viteServer: vite.ViteDevServer
  isExternal(id: string): ReturnType<typeof isExternal>
}

async function transformRequest (opts: TransformOptions, id: string) {
  // Virtual modules start with `\0`
  if (id && id.startsWith('/@id/__x00__')) {
    id = '\0' + id.slice('/@id/__x00__'.length)
  }
  if (id && id.startsWith('/@id/')) {
    id = id.slice('/@id/'.length)
  }
  if (id && !id.startsWith('/@fs/') && id.startsWith('/')) {
    // Relative to the root directory
    const resolvedPath = resolve(opts.viteServer.config.root, '.' + id)
    if (existsSync(resolvedPath)) {
      id = resolvedPath
    }
  }

  // On Windows, we prefix absolute paths with `/@fs/` to skip node resolution algorithm
  id = id.replace(/^\/?(?=\w:)/, '/@fs/')

  // Remove query and @fs/ for external modules
  const externalId = id.replace(/\?v=\w+$|^\/@fs/, '')

  if (await opts.isExternal(externalId)) {
    const path = builtinModules.includes(externalId.split('node:').pop()!)
      ? externalId
      : isAbsolute(externalId) ? pathToFileURL(externalId).href : externalId
    return {
      code: `(global, module, _, exports, importMeta, ssrImport, ssrDynamicImport, ssrExportAll) =>
${genDynamicImport(path, { wrapper: false })}
  .then(r => {
    if (r.default && r.default.__esModule)
      r = r.default
    exports.default = r.default
    ssrExportAll(r)
  })
  .catch(e => {
    console.error(e)
    throw new Error(${JSON.stringify(`[vite dev] Error loading external "${id}".`)})
  })`,
      deps: [],
      dynamicDeps: []
    }
  }

  // Transform
  const res: SSRTransformResult = await opts.viteServer.transformRequest(id, { ssr: true }).catch((err) => {
    logger.warn(`[SSR] Error transforming ${id}:`, err)
    // console.error(err)
  }) as SSRTransformResult || { code: '', map: {}, deps: [], dynamicDeps: [] }

  // Wrap into a vite module
  const code = `async function (global, module, exports, __vite_ssr_exports__, __vite_ssr_import_meta__, __vite_ssr_import__, __vite_ssr_dynamic_import__, __vite_ssr_exportAll__) {
${res.code || '/* empty */'};
}`
  return { code, deps: res.deps || [], dynamicDeps: res.dynamicDeps || [] }
}

async function transformRequestRecursive (opts: TransformOptions, id: string, parent = '<entry>', chunks: Record<string, TransformChunk> = {}) {
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

async function bundleRequest (opts: TransformOptions, entryURL: string) {
  const chunks = (await transformRequestRecursive(opts, entryURL))!

  const listIds = (ids: string[]) => ids.map(id => `// - ${id} (${hashId(id)})`).join('\n')
  const chunksCode = chunks.map(chunk => `
// --------------------
// Request: ${chunk.id}
// Parents: \n${listIds(chunk.parents)}
// Dependencies: \n${listIds(chunk.deps)}
// --------------------
const ${hashId(chunk.id + '-' + chunk.code)} = ${chunk.code}
`).join('\n')

  const manifestCode = `const __modules__ = ${
    genObjectFromRawEntries(chunks.map(chunk => [chunk.id, hashId(chunk.id + '-' + chunk.code)]))
  }`

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

  const cjsModule = {
    get exports () {
      return stubModule.default
    },
    set exports (v) {
      stubModule.default = v
    },
  }

  await mod(
    __ssrContext__.global,
    cjsModule,
    stubModule.default,
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
    `export default await __ssrLoadModule__(${JSON.stringify(entryURL)})`
  ].join('\n\n')

  return {
    code,
    ids: chunks.map(i => i.id)
  }
}

export async function initViteDevBundler (ctx: ViteBuildContext, onBuild: () => Promise<any>) {
  const viteServer = ctx.ssrServer!
  const options: TransformOptions = {
    viteServer,
    isExternal: createIsExternal(viteServer, ctx.nuxt.options.rootDir, ctx.nuxt.options.modulesDir)
  }

  // Build and watch
  const _doBuild = async () => {
    const start = Date.now()
    const { code, ids } = await bundleRequest(options, ctx.entry)
    await fse.writeFile(resolve(ctx.nuxt.options.buildDir, 'dist/server/server.mjs'), code, 'utf-8')
    // Have CSS in the manifest to prevent FOUC on dev SSR
    await writeManifest(ctx, ids.filter(isCSS).map(i => i.slice(1)))
    const time = (Date.now() - start)
    logger.success(`Vite server built in ${time}ms`)
    await onBuild()
  }
  const doBuild = debounce(_doBuild)

  // Initial build
  await _doBuild()

  // Watch
  viteServer.watcher.on('all', (_event, file) => {
    file = normalize(file) // Fix windows paths
    if (file.indexOf(ctx.nuxt.options.buildDir) === 0 || isIgnored(file)) { return }
    doBuild()
  })
  // ctx.nuxt.hook('builder:watch', () => doBuild())
  ctx.nuxt.hook('app:templatesGenerated', () => doBuild())
}
