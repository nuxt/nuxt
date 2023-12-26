import { existsSync, promises as fsp } from 'node:fs'
import { basename, isAbsolute, join, parse, relative, resolve } from 'pathe'
import hash from 'hash-sum'
import type { Nuxt, NuxtTemplate, NuxtTypeTemplate, ResolvedNuxtTemplate, TSReference } from '@nuxt/schema'
import { withTrailingSlash } from 'ufo'
import { defu } from 'defu'
import type { TSConfig } from 'pkg-types'
import { readPackageJSON } from 'pkg-types'

import { tryResolveModule } from './internal/esm'
import { getDirectory } from './module/install'
import { tryUseNuxt, useNuxt } from './context'
import { getModulePaths } from './internal/cjs'
import { resolveNuxtModule } from './resolve'

/**
 * Renders given template during build into the project buildDir.
 * @param template - A template object or a string with the path to the template. If a string is provided, it will be converted to a template object with `src` set to the string value. If a template object is provided, it must have the {@link https://nuxt.com/docs/api/kit/templates#template following properties}.
 * @returns Nuxt template
 * @see {@link https://nuxt.com/docs/api/kit/templates#addtemplate documentation}
 */
export function addTemplate (template: NuxtTemplate<any> | string) {
  const nuxt = useNuxt()

  // Normalize template
  const normalizedTemplate = normalizeTemplate(template)

  // Remove any existing template with the same filename
  nuxt.options.build.templates = nuxt.options.build.templates
    .filter(
      (p) => normalizeTemplate(p).filename !== normalizedTemplate.filename
    )

  // Add to templates array
  nuxt.options.build.templates.push(normalizedTemplate)

  return normalizedTemplate
}

/**
 * RRenders given template during build into the project buildDir, then registers it as types.
 * @param template - A template object or a string with the path to the template. If a string is provided, it will be converted to a template object with `src` set to the string value. If a template object is provided, it must have the {@link https://nuxt.com/docs/api/kit/templates#template-1 following properties}.
 * @returns Nuxt template
 * @throws Will throw an error if template's filename does not end with '.d.ts'
 * @see {@link https://nuxt.com/docs/api/kit/templates#addtypetemplate documentation}
 */
export function addTypeTemplate (template: NuxtTypeTemplate<any>) {
  const nuxt = useNuxt()

  const _template = addTemplate(template)

  if (!_template.filename.endsWith('.d.ts')) {
    throw new Error(`Invalid type template. Filename must end with .d.ts : "${_template.filename}"`)
  }

  // Add template to types reference
  nuxt.hook('prepare:types', ({ references }) => {
    references.push({ path: _template.dst })
  })

  return _template
}

export function normalizeTemplate (
  template: NuxtTemplate<any> | string
): ResolvedNuxtTemplate<any> {
  if (!template) {
    throw new Error('Invalid template: ' + JSON.stringify(template))
  }

  // Normalize
  template = typeof template === 'string' ? { src: template } : { ...template }

  // Use src if provided
  if (template.src) {
    if (!existsSync(template.src)) {
      throw new Error('Template not found: ' + template.src)
    }

    if (!template.filename) {
      const sourcePath = parse(template.src)

      template.filename = (template as any).fileName
        || `${basename(sourcePath.dir)}.${sourcePath.name}.${hash(template.src)}${sourcePath.ext}`
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
 * Regenerate templates that match the filter. If no filter is provided, all templates will be regenerated.
 * @param options - Options to pass to the template.
 * @param options.filter - A function that will be called with the `template` object. It should return a boolean indicating whether the template should be regenerated. If `filter` is not provided, all templates will be regenerated.
 * @see {@link https://nuxt.com/docs/api/kit/templates#updatetemplates documentation}
 */
export async function updateTemplates (
  options?: { filter?: (template: ResolvedNuxtTemplate<any>) => boolean }
) {
  await tryUseNuxt()?.hooks.callHook('builder:generateApp', options)
}

export async function writeTypes (nuxt: Nuxt) {
  const nodeModulePaths = getModulePaths(nuxt.options.modulesDir)

  const rootDirectoryWithSlash = withTrailingSlash(nuxt.options.rootDir)

  const modulePaths = await resolveNuxtModule(rootDirectoryWithSlash,
    nuxt.options._installedModules
      .filter((m) => m.entryPath)
      .map((m) => getDirectory(m.entryPath))
  )

  const tsConfig: TSConfig = defu(nuxt.options.typescript.tsConfig, {
    compilerOptions: {
      forceConsistentCasingInFileNames: true,
      jsx: 'preserve',
      jsxImportSource: 'vue',
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: nuxt.options.experimental.typescriptBundlerResolution ? 'Bundler' : 'Node',
      skipLibCheck: true,
      isolatedModules: true,
      useDefineForClassFields: true,
      strict: nuxt.options.typescript.strict,
      noImplicitThis: true,
      esModuleInterop: true,
      types: [],
      verbatimModuleSyntax: true,
      allowJs: true,
      noEmit: true,
      resolveJsonModule: true,
      allowSyntheticDefaultImports: true,
      paths: {}
    },
    include: [
      './nuxt.d.ts',
      join(
        relativeWithDot(nuxt.options.buildDir, nuxt.options.rootDir), '**/*'
      ),
      ...nuxt.options.srcDir === nuxt.options.rootDir
        ? []
        : [join(relative(nuxt.options.buildDir, nuxt.options.srcDir), '**/*')],
      ...nuxt.options._layers.map((layer) => layer.config.srcDir || layer.cwd)
        .filter(
          (sourceOrCwd) => !sourceOrCwd.startsWith(rootDirectoryWithSlash)
          || sourceOrCwd.includes('node_modules')
        )
        .map((sourceOrCwd) => join(relative(nuxt.options.buildDir, sourceOrCwd), '**/*')),
      ...nuxt.options.typescript.includeWorkspace
      && nuxt.options.workspaceDir !== nuxt.options.rootDir
        ? [join(relative(nuxt.options.buildDir, nuxt.options.workspaceDir), '**/*')]
        : [],
      ...modulePaths.map(
        (m) => join(relativeWithDot(nuxt.options.buildDir, m), 'runtime')
      )
    ],
    exclude: [
      ...nuxt.options.modulesDir.map(
        (m) => relativeWithDot(nuxt.options.buildDir, m)
      ),
      ...modulePaths.map(
        (m) => join(relativeWithDot(nuxt.options.buildDir, m), 'runtime/server')
      ),
      relativeWithDot(nuxt.options.buildDir, resolve(nuxt.options.rootDir, 'dist'))
    ]
  } satisfies TSConfig)

  const aliases: Record<string, string> = {
    ...nuxt.options.alias,
    '#build': nuxt.options.buildDir
  }

  // Exclude bridge alias types to support Volar
  const excludedAlias = [/^@vue\/.*$/]

  const basePath = tsConfig.compilerOptions!.baseUrl
    ? resolve(nuxt.options.buildDir, tsConfig.compilerOptions!.baseUrl)
    : nuxt.options.buildDir

  tsConfig.compilerOptions = tsConfig.compilerOptions || {}

  tsConfig.include = tsConfig.include || []

  for (const alias in aliases) {
    if (excludedAlias.some((re) => re.test(alias))) {
      continue
    }

    let absolutePath = resolve(basePath, aliases[alias])

    let stats = await fsp.stat(absolutePath)
      .catch(() => {} /* file does not exist */)

    if (!stats) {
      const resolvedModule = await tryResolveModule(
        aliases[alias], nuxt.options.modulesDir
      )

      if (resolvedModule) {
        absolutePath = resolvedModule

        stats = await fsp.stat(resolvedModule).catch(() => {})
      }
    }

    const relativePath = relativeWithDot(nuxt.options.buildDir, absolutePath)

    if (stats?.isDirectory()) {
      tsConfig.compilerOptions.paths[alias] = [relativePath]

      tsConfig.compilerOptions.paths[`${alias}/*`] = [`${relativePath}/*`]

      if (!absolutePath.startsWith(rootDirectoryWithSlash)) {
        tsConfig.include.push(relativePath)
      }
    } else {
      const path = stats?.isFile()

        // remove extension
        ? relativePath.replaceAll(/(?<=\w)\.\w+$/g, '')

        // non-existent file probably shouldn't be resolved
        : aliases[alias]

      tsConfig.compilerOptions.paths[alias] = [path]

      if (!absolutePath.startsWith(rootDirectoryWithSlash)) {
        tsConfig.include.push(path)
      }
    }
  }

  const references: TSReference[] = await Promise.all([
    ...nuxt.options.modules,
    ...nuxt.options._modules
  ]
    .filter((f) => typeof f === 'string')
    .map(
      async (id: string) => 
        ({
          types: (
            await readPackageJSON(id, { url: nodeModulePaths })
              .catch(() => null))?.name || id
        })
    )
  )
  

  const declarations: string[] = []

  await nuxt.callHook('prepare:types', { references, declarations, tsConfig })

  for (const alias in tsConfig.compilerOptions.paths) {
    const paths = tsConfig.compilerOptions.paths[alias]

    tsConfig.compilerOptions.paths[alias] = await Promise.all(
      paths.map(async (path: string) => {
        if (!isAbsolute(path)) {
          return path
        }

        const stats = await fsp.stat(path)
          .catch(() => {} /* file does not exist */)

        return relativeWithDot(
          nuxt.options.buildDir,
          stats?.isFile()
            ? path.replaceAll(/(?<=\w)\.\w+$/g, '') /* remove extension */
            : path
        )
      })
    )
  }

  tsConfig.include = [
    ...new Set(
      tsConfig.include.map(
        (p) => (isAbsolute(p) ? relativeWithDot(nuxt.options.buildDir, p) : p)
      )
    )
  ]

  tsConfig.exclude = [
    ...new Set(
      (tsConfig.exclude || []).map(
        (p) => (isAbsolute(p) ? relativeWithDot(nuxt.options.buildDir, p) : p)
      )
    )
  ]

  const declaration = [
    ...references.map((reference) => {
      if ('path' in reference && isAbsolute(reference.path)) {
        reference.path = relative(nuxt.options.buildDir, reference.path)
      }

      return `/// <reference ${renderAttributes(reference)} />`
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

    await fsp.writeFile(tsConfigPath, GeneratedBy + '\n' + JSON.stringify(tsConfig, undefined, 2))

    const declarationPath = resolve(nuxt.options.buildDir, 'nuxt.d.ts')

    await fsp.writeFile(declarationPath, GeneratedBy + '\n' + declaration)
  }

  // This is needed for Nuxt 2 which clears
  // the build directory again before building
  // https://github.com/nuxt/nuxt/blob/2.x/packages/builder/src/builder.js#L144
  // @ts-expect-error TODO: Nuxt 2 hook
  nuxt.hook('builder:prepared', writeFile)

  await writeFile()
}

function renderAttributes (object: Record<string, string>) {
  return Object.entries(object).map((entry) => renderAttribute(entry[0], entry[1])).join(' ')
}

function renderAttribute (key: string, value: string) {
  return value ? `${key}="${value}"` : ''
}

function relativeWithDot (from: string, to: string) {
  return relative(from, to).replace(/^([^.])/, './$1') || '.'
}
