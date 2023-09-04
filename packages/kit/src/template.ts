import { existsSync, promises as fsp } from 'node:fs'
import { basename, isAbsolute, join, parse, relative, resolve } from 'pathe'
import hash from 'hash-sum'
import type { Nuxt, NuxtTemplate, NuxtTypeTemplate, ResolvedNuxtTemplate, TSReference } from '@nuxt/schema'
import { withTrailingSlash } from 'ufo'
import { defu } from 'defu'
import type { TSConfig } from 'pkg-types'
import { readPackageJSON } from 'pkg-types'

import { tryResolveModule } from './internal/esm'
import { tryUseNuxt, useNuxt } from './context'
import { getModulePaths } from './internal/cjs'

/**
 * Renders given template using lodash template during build into the project buildDir
 */
export function addTemplate (_template: NuxtTemplate<any> | string) {
  const nuxt = useNuxt()

  // Normalize template
  const template = normalizeTemplate(_template)

  // Remove any existing template with the same filename
  nuxt.options.build.templates = nuxt.options.build.templates
    .filter(p => normalizeTemplate(p).filename !== template.filename)

  // Add to templates array
  nuxt.options.build.templates.push(template)

  return template
}

/**
 * Renders given types using lodash template during build into the project buildDir
 * and register them as types.
 */
export function addTypeTemplate (_template: NuxtTypeTemplate<any>) {
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
export function normalizeTemplate (template: NuxtTemplate<any> | string): ResolvedNuxtTemplate<any> {
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
      template.filename = (template as any).fileName ||
        `${basename(srcPath.dir)}.${srcPath.name}.${hash(template.src)}${srcPath.ext}`
    }
  }

  if (!template.src && !template.getContents) {
    throw new Error('Invalid template. Either getContents or src options should be provided: ' + JSON.stringify(template))
  }

  if (!template.filename) {
    throw new Error('Invalid template. Either filename should be provided: ' + JSON.stringify(template))
  }

  // Always write declaration files
  if (template.filename.endsWith('.d.ts')) {
    template.write = true
  }

  // Resolve dst
  if (!template.dst) {
    const nuxt = useNuxt()
    template.dst = resolve(nuxt.options.buildDir, template.filename)
  }

  return template as ResolvedNuxtTemplate<any>
}

/**
 * Trigger rebuilding Nuxt templates
 *
 * You can pass a filter within the options to selectively regenerate a subset of templates.
 */
export async function updateTemplates (options?: { filter?: (template: ResolvedNuxtTemplate<any>) => boolean }) {
  return await tryUseNuxt()?.hooks.callHook('builder:generateApp', options)
}
export async function writeTypes (nuxt: Nuxt) {
  const modulePaths = getModulePaths(nuxt.options.modulesDir)

  const rootDirWithSlash = withTrailingSlash(nuxt.options.rootDir)

  const tsConfig: TSConfig = defu(nuxt.options.typescript?.tsConfig, {
    compilerOptions: {
      forceConsistentCasingInFileNames: true,
      jsx: 'preserve',
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: nuxt.options.experimental?.typescriptBundlerResolution ? 'Bundler' : 'Node',
      skipLibCheck: true,
      isolatedModules: true,
      useDefineForClassFields: true,
      strict: nuxt.options.typescript?.strict ?? true,
      allowJs: true,
      noEmit: true,
      resolveJsonModule: true,
      allowSyntheticDefaultImports: true,
      paths: {}
    },
    include: [
      './nuxt.d.ts',
      join(relativeWithDot(nuxt.options.buildDir, nuxt.options.rootDir), '**/*'),
      ...nuxt.options.srcDir !== nuxt.options.rootDir ? [join(relative(nuxt.options.buildDir, nuxt.options.srcDir), '**/*')] : [],
      ...nuxt.options._layers.map(layer => layer.config.srcDir ?? layer.cwd)
        .filter(srcOrCwd => !srcOrCwd.startsWith(rootDirWithSlash) || srcOrCwd.includes('node_modules'))
        .map(srcOrCwd => join(relative(nuxt.options.buildDir, srcOrCwd), '**/*')),
      ...nuxt.options.typescript.includeWorkspace && nuxt.options.workspaceDir !== nuxt.options.rootDir ? [join(relative(nuxt.options.buildDir, nuxt.options.workspaceDir), '**/*')] : []
    ],
    exclude: [
      ...nuxt.options.modulesDir.map(m => relativeWithDot(nuxt.options.buildDir, m)),
      // nitro generate output: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/core/nitro.ts#L186
      relativeWithDot(nuxt.options.buildDir, resolve(nuxt.options.rootDir, 'dist'))
    ]
  } satisfies TSConfig)

  const aliases: Record<string, string> = {
    ...nuxt.options.alias,
    '#build': nuxt.options.buildDir
  }

  // Exclude bridge alias types to support Volar
  const excludedAlias = [/^@vue\/.*$/]

  const basePath = tsConfig.compilerOptions!.baseUrl ? resolve(nuxt.options.buildDir, tsConfig.compilerOptions!.baseUrl) : nuxt.options.buildDir

  tsConfig.compilerOptions = tsConfig.compilerOptions || {}
  tsConfig.include = tsConfig.include || []

  for (const alias in aliases) {
    if (excludedAlias.some(re => re.test(alias))) {
      continue
    }
    let absolutePath = resolve(basePath, aliases[alias])
    let stats = await fsp.stat(absolutePath).catch(() => null /* file does not exist */)
    if (!stats) {
      const resolvedModule = await tryResolveModule(aliases[alias], nuxt.options.modulesDir)
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
        ? relativePath.replace(/(?<=\w)\.\w+$/g, '')
        // non-existent file probably shouldn't be resolved
        : aliases[alias]

      tsConfig.compilerOptions.paths[alias] = [path]

      if (!absolutePath.startsWith(rootDirWithSlash)) {
        tsConfig.include.push(path)
      }
    }
  }

  const references: TSReference[] = await Promise.all([
    ...nuxt.options.modules,
    ...nuxt.options._modules
  ]
    .filter(f => typeof f === 'string')
    .map(async id => ({ types: (await readPackageJSON(id, { url: modulePaths }).catch(() => null))?.name || id })))

  if (nuxt.options.experimental?.reactivityTransform) {
    references.push({ types: 'vue/macros-global' })
  }

  const declarations: string[] = []

  await nuxt.callHook('prepare:types', { references, declarations, tsConfig })

  for (const alias in tsConfig.compilerOptions!.paths) {
    const paths = tsConfig.compilerOptions!.paths[alias]
    tsConfig.compilerOptions!.paths[alias] = await Promise.all(paths.map(async (path: string) => {
      if (!isAbsolute(path)) { return path }
      const stats = await fsp.stat(path).catch(() => null /* file does not exist */)
      return relativeWithDot(nuxt.options.buildDir, stats?.isFile() ? path.replace(/(?<=\w)\.\w+$/g, '') /* remove extension */ : path)
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
    ''
  ].join('\n')

  async function writeFile () {
    const GeneratedBy = '// Generated by nuxi'

    const tsConfigPath = resolve(nuxt.options.buildDir, 'tsconfig.json')
    await fsp.mkdir(nuxt.options.buildDir, { recursive: true })
    await fsp.writeFile(tsConfigPath, GeneratedBy + '\n' + JSON.stringify(tsConfig, null, 2))

    const declarationPath = resolve(nuxt.options.buildDir, 'nuxt.d.ts')
    await fsp.writeFile(declarationPath, GeneratedBy + '\n' + declaration)
  }

  // This is needed for Nuxt 2 which clears the build directory again before building
  // https://github.com/nuxt/nuxt/blob/2.x/packages/builder/src/builder.js#L144
  // @ts-expect-error TODO: Nuxt 2 hook
  nuxt.hook('builder:prepared', writeFile)

  await writeFile()
}

function renderAttrs (obj: Record<string, string>) {
  return Object.entries(obj).map(e => renderAttr(e[0], e[1])).join(' ')
}

function renderAttr (key: string, value: string) {
  return value ? `${key}="${value}"` : ''
}

function relativeWithDot (from: string, to: string) {
  return relative(from, to).replace(/^([^.])/, './$1') || '.'
}
