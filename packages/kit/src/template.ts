import { existsSync, promises as fsp } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, isAbsolute, join, normalize, parse, relative, resolve } from 'pathe'
import { hash } from 'ohash'
import type { Nuxt, NuxtServerTemplate, NuxtTemplate, NuxtTypeTemplate, ResolvedNuxtTemplate, TSReference } from '@nuxt/schema'
import { withTrailingSlash } from 'ufo'
import { defu } from 'defu'
import type { TSConfig } from 'pkg-types'
import { gte } from 'semver'
import { readPackageJSON } from 'pkg-types'
import { resolveModulePath } from 'exsolve'
import { captureStackTrace } from 'errx'

import { distDirURL, filterInPlace } from './utils'
import { directoryToURL } from './internal/esm'
import { getDirectory } from './module/install'
import { tryUseNuxt, useNuxt } from './context'
import { resolveNuxtModule } from './resolve'

/**
 * Renders given template during build into the virtual file system (and optionally to disk in the project `buildDir`)
 */
export function addTemplate<T> (_template: NuxtTemplate<T> | string) {
  const nuxt = useNuxt()

  // Normalize template
  const template = normalizeTemplate(_template)

  // Remove any existing template with the same destination path
  filterInPlace(nuxt.options.build.templates, p => normalizeTemplate(p).dst !== template.dst)

  try {
    const distDir = distDirURL.toString()
    const { source } = captureStackTrace().find(e => e.source && !e.source.startsWith(distDir)) ?? {}
    if (source) {
      const path = normalize(fileURLToPath(source))
      if (existsSync(path)) {
        template._path = path
      }
    }
  } catch {
    // ignore errors as this is an additive feature
  }

  // Add to templates array
  nuxt.options.build.templates.push(template)

  return template
}

/**
 * Adds a virtual file that can be used within the Nuxt Nitro server build.
 */
export function addServerTemplate (template: NuxtServerTemplate) {
  const nuxt = useNuxt()

  nuxt.options.nitro.virtual ||= {}
  nuxt.options.nitro.virtual[template.filename] = template.getContents

  return template
}

/**
 * Renders given types during build to disk in the project `buildDir`
 * and register them as types.
 *
 * You can pass a second context object to specify in which context the type should be added.
 *
 * If no context object is passed, then it will only be added to the nuxt context.
 */
export function addTypeTemplate<T> (_template: NuxtTypeTemplate<T>, context?: { nitro?: boolean, nuxt?: boolean, node?: boolean }) {
  const nuxt = useNuxt()

  const template = addTemplate(_template)

  if (!template.filename.endsWith('.d.ts')) {
    throw new Error(`Invalid type template. Filename must end with .d.ts : "${template.filename}"`)
  }

  // Add template to types reference
  if (!context || context.nuxt) {
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: template.dst })
    })
  }
  if (context?.node) {
    nuxt.hook('prepare:types', ({ nodeReferences }) => {
      nodeReferences.push({ path: template.dst })
    })
  }
  if (context?.nitro) {
    nuxt.hook('nitro:prepare:types', ({ references }) => {
      references.push({ path: template.dst })
    })
  }

  return template
}

/**
 * Normalize a nuxt template object
 */
export function normalizeTemplate<T> (template: NuxtTemplate<T> | string, buildDir?: string): ResolvedNuxtTemplate<T> {
  if (!template) {
    throw new Error('Invalid template: ' + JSON.stringify(template))
  }

  // Normalize
  if (typeof template === 'string') {
    template = { src: template }
  } else {
    template = { ...template }
  }

  // Use src if provided
  if (template.src) {
    if (!existsSync(template.src)) {
      throw new Error('Template not found: ' + template.src)
    }
    if (!template.filename) {
      const srcPath = parse(template.src)
      template.filename = (template as any).fileName || `${basename(srcPath.dir)}.${srcPath.name}.${hash(template.src).replace(/-/g, '_')}${srcPath.ext}`
    }
  }

  if (!template.src && !template.getContents) {
    throw new Error('Invalid template. Either `getContents` or `src` should be provided: ' + JSON.stringify(template))
  }

  if (!template.filename) {
    throw new Error('Invalid template. `filename` must be provided: ' + JSON.stringify(template))
  }

  // Always write declaration files
  if (template.filename.endsWith('.d.ts')) {
    template.write = true
  }

  // Resolve dst
  template.dst ||= resolve(buildDir ?? useNuxt().options.buildDir, template.filename)

  return template as ResolvedNuxtTemplate<T>
}

/**
 * Trigger rebuilding Nuxt templates
 *
 * You can pass a filter within the options to selectively regenerate a subset of templates.
 */
export async function updateTemplates (options?: { filter?: (template: ResolvedNuxtTemplate<any>) => boolean }) {
  return await tryUseNuxt()?.hooks.callHook('builder:generateApp', options)
}

function resolveLayerPaths (buildDir: string, rootDir: string, srcDir: string) {
  const relativeRootDir = relativeWithDot(buildDir, rootDir)
  return {
    nuxt: [
      join(relativeWithDot(buildDir, srcDir), '**/*'),
      join(relativeRootDir, 'modules/*/runtime/**/*'),
      join(relativeRootDir, 'layers/*/modules/*/runtime/**/*'),
    ],
    nitro: [
      join(relativeRootDir, 'modules/*/runtime/server/**/*'),
      join(relativeRootDir, 'layers/*/modules/*/runtime/server/**/*'),
    ],
    node: [
      join(relativeRootDir, 'modules/**/*'),
      join(relativeRootDir, 'nuxt.config.*'),
      join(relativeRootDir, '.config/nuxt.*'),
      join(relativeRootDir, 'layers/*/nuxt.config.*'),
      join(relativeRootDir, 'layers/*/.config/nuxt.*'),
      join(relativeRootDir, 'layers/*/modules/**/*'),
    ],
  }
}

const EXTENSION_RE = /\b(?:\.d\.[cm]?ts|\.\w+)$/g
// Exclude bridge alias types to support Volar
const excludedAlias = [/^@vue\/.*$/, /^#internal\/nuxt/]
export async function _generateTypes (nuxt: Nuxt) {
  const include = new Set<string>(['./nuxt.d.ts'])
  const nodeInclude = new Set<string>(['./nuxt.node.d.ts'])
  const legacyInclude = new Set<string>(['./nuxt.d.ts'])

  const exclude = new Set<string>()
  const nodeExclude = new Set<string>()
  const legacyExclude = new Set<string>()

  if (nuxt.options.typescript.includeWorkspace && nuxt.options.workspaceDir !== nuxt.options.srcDir) {
    include.add(join(relative(nuxt.options.buildDir, nuxt.options.workspaceDir), '**/*'))
    legacyInclude.add(join(relative(nuxt.options.buildDir, nuxt.options.workspaceDir), '**/*'))
  }

  // node_modules folders
  for (const dir of nuxt.options.modulesDir) {
    exclude.add(relativeWithDot(nuxt.options.buildDir, dir))
    nodeExclude.add(relativeWithDot(nuxt.options.buildDir, dir))
    legacyExclude.add(relativeWithDot(nuxt.options.buildDir, dir))
  }

  // nitro generate output: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/core/nitro.ts#L186
  // + nitro generate .data in development when kv storage is used
  for (const dir of ['dist', '.data']) {
    exclude.add(relativeWithDot(nuxt.options.buildDir, resolve(nuxt.options.rootDir, dir)))
    nodeExclude.add(relativeWithDot(nuxt.options.buildDir, resolve(nuxt.options.rootDir, dir)))
    legacyExclude.add(relativeWithDot(nuxt.options.buildDir, resolve(nuxt.options.rootDir, dir)))
  }

  const rootDirWithSlash = withTrailingSlash(nuxt.options.rootDir)
  for (const layer of nuxt.options._layers) {
    const srcOrCwd = withTrailingSlash(layer.config.srcDir ?? layer.cwd)
    if (!srcOrCwd.startsWith(rootDirWithSlash) || layer.cwd === nuxt.options.rootDir || srcOrCwd.includes('node_modules')) {
      const rootGlob = join(relativeWithDot(nuxt.options.buildDir, layer.cwd), '**/*')
      const paths = resolveLayerPaths(nuxt.options.buildDir, layer.cwd, layer.config.srcDir)
      for (const path of paths.nuxt) {
        include.add(path)
        legacyInclude.add(path)
        if (path !== rootGlob) {
          nodeExclude.add(path)
        }
      }
      for (const path of paths.nitro) {
        exclude.add(path)
        nodeExclude.add(path)
        legacyExclude.add(path)
      }
      for (const path of paths.node) {
        nodeInclude.add(path)
        legacyInclude.add(path)
        exclude.add(path)
      }
    }
  }

  const moduleEntryPaths: string[] = []
  for (const m of nuxt.options._installedModules) {
    if (m.entryPath) {
      moduleEntryPaths.push(getDirectory(m.entryPath))
    }
  }

  const modulePaths = await resolveNuxtModule(rootDirWithSlash, moduleEntryPaths)

  for (const path of modulePaths) {
    const relative = relativeWithDot(nuxt.options.buildDir, path)
    include.add(join(relative, 'runtime'))
    include.add(join(relative, 'dist/runtime'))
    legacyInclude.add(join(relative, 'runtime'))
    legacyInclude.add(join(relative, 'dist/runtime'))

    nodeExclude.add(join(relative, 'runtime'))
    nodeExclude.add(join(relative, 'dist/runtime'))

    exclude.add(join(relative, 'runtime/server'))
    exclude.add(join(relative, 'dist/runtime/server'))
    legacyExclude.add(join(relative, 'runtime/server'))
    legacyExclude.add(join(relative, 'dist/runtime/server'))
  }

  const nestedModulesDirs: string[] = []
  for (const dir of [...nuxt.options.modulesDir].sort()) {
    const withSlash = withTrailingSlash(dir)
    if (nestedModulesDirs.every(d => !d.startsWith(withSlash))) {
      nestedModulesDirs.push(withSlash)
    }
  }

  let hasTypescriptVersionWithModulePreserve
  for (const parent of nestedModulesDirs) {
    hasTypescriptVersionWithModulePreserve ??= await readPackageJSON('typescript', { parent })
      .then(r => r?.version && gte(r.version, '5.4.0'))
      .catch(() => undefined)
  }
  hasTypescriptVersionWithModulePreserve ??= true

  const useDecorators = Boolean(nuxt.options.experimental?.decorators)

  const nodeReferences: TSReference[] = []

  // This describes the environment where we load `nuxt.config.ts` (and modules)
  const nodeTsConfig: TSConfig = defu(nuxt.options.typescript?.nodeTsConfig, {
    compilerOptions: {
      /* Base options: */
      esModuleInterop: true,
      skipLibCheck: true,
      target: 'ESNext',
      allowJs: true,
      resolveJsonModule: true,
      moduleDetection: 'force',
      isolatedModules: true,
      verbatimModuleSyntax: true,
      /* Strictness */
      strict: nuxt.options.typescript?.strict ?? true,
      noUncheckedIndexedAccess: true,
      forceConsistentCasingInFileNames: true,
      noImplicitOverride: true,
      /* If NOT transpiling with TypeScript: */
      module: hasTypescriptVersionWithModulePreserve ? 'preserve' : 'ESNext',
      noEmit: true,
      /* remove auto-scanning for types */
      types: [],
      /* add paths object for filling-in later */
      paths: {},
      /* Possibly consider removing the following in future */
      moduleResolution: hasTypescriptVersionWithModulePreserve ? undefined : 'Bundler',
      useDefineForClassFields: true, /* implied by target: es2022+ */
      noImplicitThis: true, /* enabled with `strict` */
      allowSyntheticDefaultImports: true,
    },
    include: [...nodeInclude],
    exclude: [...nodeExclude],
  } satisfies TSConfig)

  // https://www.totaltypescript.com/tsconfig-cheat-sheet
  const tsConfig: TSConfig = defu(nuxt.options.typescript?.tsConfig, {
    compilerOptions: {
      /* Base options: */
      esModuleInterop: true,
      skipLibCheck: true,
      target: 'ESNext',
      allowJs: true,
      resolveJsonModule: true,
      moduleDetection: 'force',
      isolatedModules: true,
      verbatimModuleSyntax: true,
      /* Strictness */
      strict: nuxt.options.typescript?.strict ?? true,
      noUncheckedIndexedAccess: true,
      forceConsistentCasingInFileNames: true,
      noImplicitOverride: true,
      /* Decorator support */
      ...useDecorators
        ? {
            experimentalDecorators: false,
          }
        : {},
      /* If NOT transpiling with TypeScript: */
      module: hasTypescriptVersionWithModulePreserve ? 'preserve' : 'ESNext',
      noEmit: true,
      /* If your code runs in the DOM: */
      lib: [
        'ESNext',
        ...useDecorators ? ['esnext.decorators'] : [],
        'dom',
        'dom.iterable',
        'webworker',
      ],
      /* JSX support for Vue */
      jsx: 'preserve',
      jsxImportSource: 'vue',
      /* remove auto-scanning for types */
      types: [],
      /* add paths object for filling-in later */
      paths: {},
      /* Possibly consider removing the following in future */
      moduleResolution: nuxt.options.future?.typescriptBundlerResolution || (nuxt.options.experimental as any)?.typescriptBundlerResolution ? 'Bundler' : 'Node', /* implied by module: preserve */
      useDefineForClassFields: true, /* implied by target: es2022+ */
      noImplicitThis: true, /* enabled with `strict` */
      allowSyntheticDefaultImports: true,
    },
    include: [...include],
    exclude: [...exclude],
  } satisfies TSConfig)

  const aliases: Record<string, string> = nuxt.options.alias

  const basePath = tsConfig.compilerOptions!.baseUrl
    ? resolve(nuxt.options.buildDir, tsConfig.compilerOptions!.baseUrl)
    : nuxt.options.buildDir

  tsConfig.compilerOptions ||= {}
  tsConfig.compilerOptions.paths ||= {}
  tsConfig.include ||= []

  const importPaths = nuxt.options.modulesDir.map(d => directoryToURL(d))

  for (const alias in aliases) {
    if (excludedAlias.some(re => re.test(alias))) {
      continue
    }
    let absolutePath = resolve(basePath, aliases[alias]!)
    let stats = await fsp.stat(absolutePath).catch(() => null /* file does not exist */)
    if (!stats) {
      const resolvedModule = resolveModulePath(aliases[alias]!, {
        try: true,
        from: importPaths,
        extensions: [...nuxt.options.extensions, '.d.ts', '.d.mts', '.d.cts'],
      })
      if (resolvedModule) {
        absolutePath = resolvedModule
        stats = await fsp.stat(resolvedModule).catch(() => null)
      }
    }

    const relativePath = relativeWithDot(nuxt.options.buildDir, absolutePath)
    if (stats?.isDirectory()) {
      tsConfig.compilerOptions.paths[alias] = [relativePath]
      tsConfig.compilerOptions.paths[`${alias}/*`] = [`${relativePath}/*`]
    } else {
      const path = stats?.isFile()
        // remove extension
        ? relativePath.replace(EXTENSION_RE, '')
        // non-existent file probably shouldn't be resolved
        : aliases[alias]!

      tsConfig.compilerOptions.paths[alias] = [path]
    }
  }

  const references: TSReference[] = []
  await Promise.all([...nuxt.options.modules, ...nuxt.options._modules].map(async (id) => {
    if (typeof id !== 'string') { return }

    for (const parent of nestedModulesDirs) {
      const pkg = await readPackageJSON(id, { parent }).catch(() => null)
      if (pkg) {
        references.push(({ types: pkg.name ?? id }))
        return
      }
    }

    references.push(({ types: id }))
  }))

  const declarations: string[] = []

  await nuxt.callHook('prepare:types', { references, declarations, tsConfig, nodeTsConfig, nodeReferences })

  for (const alias in tsConfig.compilerOptions!.paths) {
    const paths = tsConfig.compilerOptions!.paths[alias]
    tsConfig.compilerOptions!.paths[alias] = await Promise.all(paths.map(async (path: string) => {
      if (!isAbsolute(path)) { return path }
      const stats = await fsp.stat(path).catch(() => null /* file does not exist */)
      return relativeWithDot(nuxt.options.buildDir, stats?.isFile() ? path.replace(EXTENSION_RE, '') /* remove extension */ : path)
    }))
  }

  // Ensure `#build` is placed at the end of the paths object.
  // https://github.com/nuxt/nuxt/issues/30325
  sortTsPaths(tsConfig.compilerOptions.paths)

  tsConfig.include = [...new Set(tsConfig.include.map(p => isAbsolute(p) ? relativeWithDot(nuxt.options.buildDir, p) : p))]
  tsConfig.exclude = [...new Set(tsConfig.exclude!.map(p => isAbsolute(p) ? relativeWithDot(nuxt.options.buildDir, p) : p))]

  const declaration = [
    ...references.map((ref) => {
      if ('path' in ref && isAbsolute(ref.path)) {
        ref.path = relative(nuxt.options.buildDir, ref.path)
      }
      return `/// <reference ${renderAttrs(ref)} />`
    }),
    ...declarations,
    '',
    'export {}',
    '',
  ].join('\n')

  const nodeDeclaration = [
    ...nodeReferences.map((ref) => {
      if ('path' in ref && isAbsolute(ref.path)) {
        ref.path = relative(nuxt.options.buildDir, ref.path)
      }
      return `/// <reference ${renderAttrs(ref)} />`
    }),
    '',
    'export {}',
    '',
  ].join('\n')

  // Legacy tsConfig for backward compatibility
  const legacyTsConfig: TSConfig = defu({}, tsConfig, {
    include: [...legacyInclude],
    exclude: [...legacyExclude],
  })

  return {
    declaration,
    nodeTsConfig,
    nodeDeclaration,
    tsConfig,
    legacyTsConfig,
  }
}

export async function writeTypes (nuxt: Nuxt) {
  const { tsConfig, nodeTsConfig, nodeDeclaration, declaration, legacyTsConfig } = await _generateTypes(nuxt)

  const appTsConfigPath = resolve(nuxt.options.buildDir, 'tsconfig.app.json')
  const legacyTsConfigPath = resolve(nuxt.options.buildDir, 'tsconfig.json')
  const nodeTsConfigPath = resolve(nuxt.options.buildDir, 'tsconfig.node.json')
  const declarationPath = resolve(nuxt.options.buildDir, 'nuxt.d.ts')
  const nodeDeclarationPath = resolve(nuxt.options.buildDir, 'nuxt.node.d.ts')

  await fsp.mkdir(nuxt.options.buildDir, { recursive: true })
  await Promise.all([
    fsp.writeFile(appTsConfigPath, JSON.stringify(tsConfig, null, 2)),
    fsp.writeFile(legacyTsConfigPath, JSON.stringify(legacyTsConfig, null, 2)),
    fsp.writeFile(nodeTsConfigPath, JSON.stringify(nodeTsConfig, null, 2)),
    fsp.writeFile(declarationPath, declaration),
    fsp.writeFile(nodeDeclarationPath, nodeDeclaration),
  ])
}

function sortTsPaths (paths: Record<string, string[]>) {
  for (const pathKey in paths) {
    if (pathKey.startsWith('#build')) {
      const pathValue = paths[pathKey]!
      // Delete & Reassign to ensure key is inserted at the end of object.
      delete paths[pathKey]
      paths[pathKey] = pathValue
    }
  }
}

function renderAttrs (obj: Record<string, string>) {
  const attrs: string[] = []
  for (const key in obj) {
    attrs.push(renderAttr(key, obj[key]))
  }
  return attrs.join(' ')
}

function renderAttr (key: string, value?: string) {
  return value ? `${key}="${value}"` : ''
}

const RELATIVE_WITH_DOT_RE = /^([^.])/
function relativeWithDot (from: string, to: string) {
  return relative(from, to).replace(RELATIVE_WITH_DOT_RE, './$1') || '.'
}
