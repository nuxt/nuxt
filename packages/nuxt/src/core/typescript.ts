import { existsSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'pathe'
import { defu } from 'defu'
import { genImport, genString } from 'knitwork'
import { resolveModulePath } from 'exsolve'
import { addTemplate, addTypeTemplate, directoryToURL, getLayerDirectories, resolveTypePaths, tryUseNitro } from '@nuxt/kit'
import type { ResolveTypePathsOptions } from '@nuxt/kit'
import type { NitroConfig, Nuxt } from 'nuxt/schema'

import { pkgDir } from '../dirs.ts'
import { findVitePlusConfig } from './external-config-files.ts'
import { buildServerRoutes, collectPageRoutes, collectServerRoutes, emitServerRoutesModule, resolveServerRoutes } from './utils/server-routes.ts'

const builderEnvTypes: Record<string, string> = {
  // defaults from `builder` based on package name
  '@nuxt/rspack-builder': '@rsbuild/core/types',
  '@nuxt/vite-builder': 'vite/client',
  '@nuxt/webpack-builder': 'webpack/module',
  // simpler overrides from `typescript.builder`
  'rspack': '@rsbuild/core/types',
  'vite': 'vite/client',
  'webpack': 'webpack/module',
  // default 'merged' builder environment for module authors
  'shared': '@nuxt/schema/builder-env',
}

const nightlies = new Map(['nitropack', 'nitro', 'h3', 'nuxt', '@nuxt/schema', '@nuxt/kit'].map(pkg => [pkg, `${pkg}-nightly`]))

const JS_EXTENSION_RE = /\.(m|c)?js$/

export function setupTypes (nuxt: Nuxt) {
  // The compiler emits the route tree, an exact-match table for the fully static paths, the path
  // union as source and accessors specialised to this route set. It is a module rather than an
  // ambient declaration because the accessors are type aliases, which cannot be reached through
  // interface augmentation; the app layer imports them from `#build/server-routes`.
  addTemplate({
    filename: 'server-routes.d.ts',
    // the routes come from the server builder's own scan, so only a page change (where pages are
    // part of the schema) can affect the output
    dependsOn: nuxt.options.experimental.strictRouteTypes === 'isomorphic' ? ['pages'] : [],
    getContents: async ({ app, nuxt }) => {
      // handler specifiers are relative to the emitted file, at the root of the build directory
      const emittedFrom = nuxt.options.buildDir
      // typing requests from the generated route set changes what a resolving call returns - a
      // serialized response, a narrowed request, a rejected method - so it is opt-in until the next
      // compatibility version. The route set is generated either way, so the two agree about what
      // the server serves before anything is typed from it.
      const typeFromRoutes = nuxt.options.experimental.routeTypedFetch
      const { routes, requestTypes } = await resolveServerRoutes(nuxt)

      // under `'isomorphic'` the pages the Vue router serves are part of the route set: nitro does
      // not know about the renderer, so a page's path is otherwise invisible and would be rejected
      const pages = nuxt.options.experimental.strictRouteTypes === 'isomorphic'
        ? buildServerRoutes(collectServerRoutes(collectPageRoutes(app.pages || [])), emittedFrom)
            .map(route => ({ ...route, metadata: { GET: { responseType: 'string' } } }))
        : []

      return emitServerRoutesModule({
        routes: buildServerRoutes(routes, emittedFrom, requestTypes),
        pages,
        requestTypes,
        strict: nuxt.options.experimental.strictRouteTypes !== false,
        typeFromRoutes,
      })
    },
  })

  // the shared context gets an empty route set, so it does not load server handlers
  addTemplate({
    filename: 'types/shared-server-routes.d.ts',
    dependsOn: [],
    getContents: () => emitServerRoutesModule({ routes: [], strict: false }),
  })

  addTypeTemplate({
    filename: 'types/nitro-layouts.d.ts',
    dependsOn: [],
    getContents: ({ app }) => [
      `export type LayoutKey = ${Object.keys(app.layouts).map(name => genString(name)).join(' | ') || 'string'}`,
      ...['@nuxt/schema', 'nuxt/schema'].flatMap(module => [
        `declare module '${module}' {`,
        '  interface AppRouteRulesExtensions {',
        '    appLayout?: LayoutKey | false',
        '  }',
        '  interface RouteRuleConfigExtensions {',
        '    appLayout?: LayoutKey | false',
        '  }',
        '}',
      ]),
    ].join('\n'),
  }, { nuxt: true, nitro: true, node: true })

  if (nuxt.options.typescript.builder !== false) {
    const overrideEnv = nuxt.options.typescript.builder && builderEnvTypes[nuxt.options.typescript.builder]
    // a custom builder object gets no environment types
    const defaultEnv = typeof nuxt.options.builder === 'string' && builderEnvTypes[nuxt.options.builder]
    const environmentTypes = overrideEnv || defaultEnv

    if (environmentTypes) {
      nuxt.options.typescript.hoist.push(environmentTypes)
      addTypeTemplate({
        filename: 'types/builder-env.d.ts',
        dependsOn: [],
        getContents: () => genImport(environmentTypes),
      })
    }
  }

  let paths: Record<string, [string]> | undefined
  let nodePaths: Record<string, [string]> | undefined
  const applyNitroTypePaths = async (nitroConfig: NitroConfig) => {
    paths ||= await resolveTypescriptPaths(nuxt)
    nitroConfig.typescript = defu(nitroConfig.typescript, {
      tsConfig: { compilerOptions: { paths: { ...paths } } },
    })
  }
  if (nuxt.options.dev) {
    nuxt.hook('prepare:types', async () => {
      const nitro = tryUseNitro()
      if (nitro) {
        await applyNitroTypePaths(nitro.options)
      }
    })
  } else {
    nuxt.hook('nitro:config', applyNitroTypePaths)
  }

  let serverBuilderReference: { path: string } | { types: string } | undefined
  /**
   * A server builder declares the augmentations it contributes (`ServerTypes`, `RuntimeConfig`,
   * …) from an `./augments` subpath export, which is referenced on its own so the declarations
   * reach the shared environment without pulling in the builder's own types. Builders without
   * that export are referenced by package name.
   */
  const getServerBuilderReference = () => {
    const builder = nuxt.options.server.builder
    // only a package can have an `augments` subpath or be referenced by name
    if (serverBuilderReference || typeof builder !== 'string' || isAbsolute(builder) || builder.startsWith('.')) {
      return serverBuilderReference
    }
    const augments = resolveModulePath(`${builder}/augments`, {
      from: [import.meta.url, directoryToURL(nuxt.options.rootDir)],
      try: true,
    })
    const declaration = augments?.replace(JS_EXTENSION_RE, (_, modifier = '') => `.d.${modifier}ts`)
    serverBuilderReference = declaration && existsSync(declaration)
      ? { path: declaration }
      : { types: builder }
    return serverBuilderReference
  }

  if (nuxt.options.experimental.routeTypedFetch) {
    // imports nothing, so that it precedes nitropack's global `$fetch`
    const { dst } = addTemplate({
      filename: 'types/fetch-global.d.ts',
      dependsOn: [],
      getContents: () => 'declare global {\n  interface NuxtGlobalFetch {}\n  var $fetch: NuxtGlobalFetch\n}\n\nexport {}\n',
    })
    // first, as the first declaration of a global `var` sets its type
    nuxt.hook('prepare:types', ({ references }) => {
      references.unshift({ path: dst })
    })
  }

  const buildPath = (path: string) => ({ path: resolve(nuxt.options.buildDir, path) })

  nuxt.hook('prepare:types', async (opts) => {
    opts.references.push(buildPath('types/plugins.d.ts'))
    if (nuxt.options.typescript.shim) {
      opts.references.push(buildPath('types/vue-shim.d.ts'))
    }
    opts.references.push(
      buildPath('types/build.d.ts'),
      buildPath('types/app.config.d.ts'),
      buildPath('types/runtime-config.d.ts'),
      { types: 'nuxt/app' },
    )

    opts.nodeReferences.push(
      buildPath('types/modules.d.ts'),
      buildPath('types/runtime-config.d.ts'),
      buildPath('types/shared-app.config.d.ts'),
      { types: 'nuxt' },
      { path: resolveModulePath('@nuxt/vite-builder', { from: import.meta.url }).replace('.mjs', '.d.mts') },
    )
    if (typeof nuxt.options.builder === 'string' && nuxt.options.builder !== '@nuxt/vite-builder') {
      opts.nodeReferences.push({ types: nuxt.options.builder })
    }

    const serverBuilderReference = getServerBuilderReference()
    if (serverBuilderReference) {
      opts.references.push(serverBuilderReference)
      opts.nodeReferences.push(serverBuilderReference)
      if ('path' in serverBuilderReference) {
        opts.sharedReferences.push(serverBuilderReference)
      }
    }

    opts.sharedReferences.push(
      buildPath('types/runtime-config.d.ts'),
      buildPath('types/shared-app.config.d.ts'),
      buildPath('types/shared-imports.d.ts'),
    )

    // resolutions for types that might be obscured with shamefully-hoist=false
    paths ||= await resolveTypescriptPaths(nuxt)
    // The `node` environment resolves as `nodenext`, which will not follow a substitution that
    // names a directory, so its packages are resolved to the entry file itself.
    nodePaths ||= await resolveTypescriptPaths(nuxt, { entry: true })
    opts.tsConfig.compilerOptions = defu(opts.tsConfig.compilerOptions, { paths: { ...paths } })
    opts.nodeTsConfig.compilerOptions = defu(opts.nodeTsConfig.compilerOptions, { paths: { ...nodePaths } })
    // required for the server builder's augmentations (referenced above)
    opts.nodeTsConfig.compilerOptions!.paths!['#app/types'] ||= [resolve(nuxt.options.appDir, 'types')]
    opts.sharedTsConfig.compilerOptions = defu(opts.sharedTsConfig.compilerOptions, { paths: { ...paths } })
    opts.sharedTsConfig.compilerOptions!.paths!['#build/server-routes'] ||= [resolve(nuxt.options.buildDir, 'types/shared-server-routes.d.ts')]

    const typesDir = nuxt.options.typesDir || nuxt.options.buildDir
    for (const dir of new Set([nuxt.options.rootDir, nuxt.options.workspaceDir])) {
      const vitePlusConfig = await findVitePlusConfig(dir)
      if (vitePlusConfig) {
        opts.nodeTsConfig.include ||= []
        opts.nodeTsConfig.include.push(relative(typesDir, vitePlusConfig))
      }
    }

    for (const dirs of getLayerDirectories(nuxt)) {
      const declaration = join(dirs.root, 'index.d.ts')
      if (existsSync(declaration)) {
        opts.references.push({ path: declaration })
        opts.nodeReferences.push({ path: declaration })
        opts.sharedReferences.push({ path: declaration })
      }
    }
  })

  nuxt.hook('nitro:prepare:types', (opts) => {
    opts.references.push(buildPath('types/shared-app.config.d.ts'), buildPath('types/runtime-config.d.ts'))

    const serverBuilderReference = getServerBuilderReference()
    if (serverBuilderReference) {
      opts.references.push(serverBuilderReference)
    }
  })
}

const NESTED_PKG_RE = /^[^@]+\//
async function resolveTypescriptPaths (nuxt: Nuxt, options?: ResolveTypePathsOptions): Promise<Record<string, [string]>> {
  nuxt.options.typescript.hoist ||= []

  const packagesToResolve: string[] = []
  const nightlyAliases = new Map<string, string>() // nightly -> original

  for (const pkg of nuxt.options.typescript.hoist) {
    const [_pkg = pkg] = NESTED_PKG_RE.test(pkg) ? pkg.split('/') : [pkg]
    const nightly = nightlies.get(_pkg)

    // packages in `package.json` can be resolved by TypeScript itself
    if (nuxt._dependencies?.has(_pkg) && !nightly) { continue }

    if (nightly) {
      const nightlyPkg = pkg.replace(_pkg, nightly)
      packagesToResolve.push(nightlyPkg)
      nightlyAliases.set(nightlyPkg, pkg)
    }

    packagesToResolve.push(pkg)
  }

  // these types must come from the copies `nuxt` resolves, not from a copy hoisted to the project root
  const nuxtOwnedPackages = packagesToResolve.filter(pkg => pkg === 'nuxt' || pkg.startsWith('nuxt/') || pkg.startsWith('@nuxt/'))
  const resolved = [
    ...await resolveTypePaths(nuxtOwnedPackages, [pkgDir, ...nuxt.options.modulesDir], options),
    ...await resolveTypePaths(packagesToResolve.filter(pkg => !nuxtOwnedPackages.includes(pkg)), nuxt.options.modulesDir, options),
  ]

  const paths: Record<string, [string]> = {}
  const nightlyResolved = new Set<string>()

  for (const [pkg, path] of resolved) {
    const original = nightlyAliases.get(pkg)
    if (original) {
      paths[original] = [path]
      paths[pkg] = [path]
      nightlyResolved.add(original)
    } else if (!nightlyResolved.has(pkg)) {
      paths[pkg] = [path]
    }
  }

  // a single module identity keeps `nuxt/schema` and `@nuxt/schema` augmentations merged
  if (paths['@nuxt/schema']) {
    paths['nuxt/schema'] = paths['@nuxt/schema']
  }

  return paths
}
