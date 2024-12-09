import { existsSync, promises as fsp } from 'node:fs'
import { basename, isAbsolute, join, parse, relative, resolve } from 'pathe'
import { hash } from 'ohash'
import type { Nuxt, NuxtServerTemplate, NuxtTemplate, NuxtTypeTemplate, ResolvedNuxtTemplate, TSReference } from '@nuxt/schema'
import { withTrailingSlash } from 'ufo'
import { defu } from 'defu'
import type { TSConfig } from 'pkg-types'
import { gte } from 'semver'
import { readPackageJSON } from 'pkg-types'

import { tryResolveModule } from './internal/esm'
import { getDirectory } from './module/install'
import { tryUseNuxt, useNuxt } from './context'
import { resolveNuxtModule } from './resolve'

/**
 * Renders given template using lodash template during build into the project buildDir
 */
export function addTemplate<T> (_template: NuxtTemplate<T> | string) {
  const nuxt = useNuxt()

  // Normalize template
  const template = normalizeTemplate(_template)

  // Remove any existing template with the same destination path
  nuxt.options.build.templates = nuxt.options.build.templates.filter(p => normalizeTemplate(p).dst !== template.dst)

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
 * Renders given types using lodash template during build into the project buildDir
 * and register them as types.
 */
export function addTypeTemplate<T> (_template: NuxtTypeTemplate<T>) {
  const nuxt = useNuxt()

  const template = addTemplate(_template)

  if (!template.filename.endsWith('.d.ts')) {
    throw new Error(`Invalid type template. Filename must end with .d.ts : "${template.filename}"`)
  }

  // Add template to types reference
  nuxt.hook('prepare:types', ({ references }) => {
    references.push({ path: template.dst })
  })

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
      template.filename = (template as any).fileName || `${basename(srcPath.dir)}.${srcPath.name}.${hash(template.src)}${srcPath.ext}`
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
  if (!template.dst) {
    template.dst = resolve(buildDir ?? useNuxt().options.buildDir, template.filename)
  }

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

const EXTENSION_RE = /\b\.\w+$/g
// Exclude bridge alias types to support Volar
const excludedAlias = [/^@vue\/.*$/, /^#internal\/nuxt/]
export async function _generateTypes (nuxt: Nuxt) {
  const rootDirWithSlash = withTrailingSlash(nuxt.options.rootDir)
  const relativeRootDir = relativeWithDot(nuxt.options.buildDir, nuxt.options.rootDir)

  const include = new Set<string>([
    './nuxt.d.ts',
    join(relativeRootDir, '.config/nuxt.*'),
    join(relativeRootDir, '**/*'),
  ])

  if (nuxt.options.srcDir !== nuxt.options.rootDir) {
    include.add(join(relative(nuxt.options.buildDir, nuxt.options.srcDir), '**/*'))
  }

  if (nuxt.options.typescript.includeWorkspace && nuxt.options.workspaceDir !== nuxt.options.rootDir) {
    include.add(join(relative(nuxt.options.buildDir, nuxt.options.workspaceDir), '**/*'))
  }

  for (const layer of nuxt.options._layers) {
    const srcOrCwd = layer.config.srcDir ?? layer.cwd
    if (!srcOrCwd.startsWith(rootDirWithSlash) || srcOrCwd.includes('node_modules')) {
      include.add(join(relative(nuxt.options.buildDir, srcOrCwd), '**/*'))
    }
  }

  const exclude = new Set<string>([
    // nitro generate output: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/core/nitro.ts#L186
    relativeWithDot(nuxt.options.buildDir, resolve(nuxt.options.rootDir, 'dist')),
  ])

  for (const dir of nuxt.options.modulesDir) {
    exclude.add(relativeWithDot(nuxt.options.buildDir, dir))
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
    exclude.add(join(relative, 'runtime/server'))
    include.add(join(relative, 'dist/runtime'))
    exclude.add(join(relative, 'dist/runtime/server'))
  }

  const isV4 = nuxt.options.future?.compatibilityVersion === 4
  const hasTypescriptVersionWithModulePreserve = await readPackageJSON('typescript', { url: nuxt.options.modulesDir })
    .then(r => r?.version && gte(r.version, '5.4.0'))
    .catch(() => isV4)

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
      noUncheckedIndexedAccess: isV4,
      forceConsistentCasingInFileNames: true,
      noImplicitOverride: true,
      /* If NOT transpiling with TypeScript: */
      module: hasTypescriptVersionWithModulePreserve ? 'preserve' : 'ESNext',
      noEmit: true,
      /* If your code runs in the DOM: */
      lib: [
        'ESNext',
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

  tsConfig.compilerOptions = tsConfig.compilerOptions || {}
  tsConfig.include = tsConfig.include || []

  for (const alias in aliases) {
    if (excludedAlias.some(re => re.test(alias))) {
      continue
    }
    let absolutePath = resolve(basePath, aliases[alias]!)
    let stats = await fsp.stat(absolutePath).catch(() => null /* file does not exist */)
    if (!stats) {
      const resolvedModule = await tryResolveModule(aliases[alias]!, nuxt.options.modulesDir)
      if (resolvedModule) {
        absolutePath = resolvedModule
        stats = await fsp.stat(resolvedModule).catch(() => null)
      }
    }

    const relativePath = relativeWithDot(nuxt.options.buildDir, absolutePath)
    if (stats?.isDirectory()) {
      tsConfig.compilerOptions.paths[alias] = [relativePath]
      tsConfig.compilerOptions.paths[`${alias}/*`] = [`${relativePath}/*`]

      if (!absolutePath.startsWith(rootDirWithSlash)) {
        tsConfig.include.push(relativePath)
      }
    } else {
      const path = stats?.isFile()
        // remove extension
        ? relativePath.replace(EXTENSION_RE, '')
        // non-existent file probably shouldn't be resolved
        : aliases[alias]!

      tsConfig.compilerOptions.paths[alias] = [path]

      if (!absolutePath.startsWith(rootDirWithSlash)) {
        tsConfig.include.push(path)
      }
    }
  }

  const references: TSReference[] = []
  await Promise.all([...nuxt.options.modules, ...nuxt.options._modules].map(async (id) => {
    if (typeof id !== 'string') { return }

    const pkg = await readPackageJSON(id, { url: nuxt.options.modulesDir }).catch(() => null)
    references.push(({ types: pkg?.name || id }))
  }))

  const declarations: string[] = []

  await nuxt.callHook('prepare:types', { references, declarations, tsConfig })

  for (const alias in tsConfig.compilerOptions!.paths) {
    const paths = tsConfig.compilerOptions!.paths[alias]
    tsConfig.compilerOptions!.paths[alias] = await Promise.all(paths.map(async (path: string) => {
      if (!isAbsolute(path)) { return path }
      const stats = await fsp.stat(path).catch(() => null /* file does not exist */)
      return relativeWithDot(nuxt.options.buildDir, stats?.isFile() ? path.replace(EXTENSION_RE, '') /* remove extension */ : path)
    }))
  }

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

  return {
    declaration,
    tsConfig,
  }
}

export async function writeTypes (nuxt: Nuxt) {
  const { tsConfig, declaration } = await _generateTypes(nuxt)

  async function writeFile () {
    const GeneratedBy = '// Generated by nuxi'

    const tsConfigPath = resolve(nuxt.options.buildDir, 'tsconfig.json')
    await fsp.mkdir(nuxt.options.buildDir, { recursive: true })
    await fsp.writeFile(tsConfigPath, GeneratedBy + '\n' + JSON.stringify(tsConfig, null, 2))

    const declarationPath = resolve(nuxt.options.buildDir, 'nuxt.d.ts')
    await fsp.writeFile(declarationPath, GeneratedBy + '\n' + declaration)
  }

  await writeFile()
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
