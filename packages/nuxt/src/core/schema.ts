import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative, resolve } from 'pathe'
import { watch } from 'chokidar'
import { defu } from 'defu'
import { debounce } from 'perfect-debounce'
import { createIsIgnored, createResolver, defineNuxtModule, directoryToURL, ensureDependencyInstalled, getAddDependencyCommand, getLayerDirectories, importModule } from '@nuxt/kit'
import { configDiagnostics, describeNativeImportFailure, getMissingCjsGlobal, isLoaderError, isMissingExportError, loadJiti, shouldReportJitiFallbackOnce } from '@nuxt/kit/internal'
import type { Jiti } from 'jiti'
import { generateTypes, resolveSchema as resolveUntypedSchema } from 'untyped'
import type { Schema, SchemaDefinition } from 'untyped'
import { linkToAlias } from '../utils.ts'
import { canImportSchema, createSchemaJiti, importSchema } from './utils/schema-loader.ts'

const defineNuxtSchema = (val: any) => val

export default defineNuxtModule({
  meta: {
    name: 'nuxt:nuxt-config-schema',
  },
  async setup (_, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Schema files are imported natively, with their JSDoc annotations added by an import-time
    // transform. `jiti` is only looked for when that fails or the runtime cannot run the transform,
    // and installing it is offered at most once.
    let installOffered = false
    let schemaJiti: Jiti | undefined

    async function getSchemaJiti (install: boolean) {
      if (schemaJiti) {
        return schemaJiti
      }
      const options = { rootDir: nuxt.options.rootDir, searchPaths: nuxt.options.modulesDir }
      let jiti = await loadJiti({ ...options, install: false })
      if (!jiti && install && !installOffered) {
        installOffered = true
        if (await ensureDependencyInstalled('jiti', options)) {
          jiti = await loadJiti({ ...options, install: false })
        }
      }
      return schemaJiti = jiti && createSchemaJiti(jiti, fileURLToPath(import.meta.url))
    }

    async function loadSchemaFile (filePath: string): Promise<SchemaDefinition | undefined> {
      const displayPath = linkToAlias(filePath, nuxt)
      const installCommand = () => getAddDependencyCommand('jiti', nuxt.options.rootDir, { dev: true })

      let nativeError: unknown
      if (canImportSchema) {
        try {
          return await importSchema(filePath) as SchemaDefinition
        } catch (error) {
          nativeError = error
        }
      }

      // Whether jiti is the answer, or the file simply has a bug that a second loader will repeat.
      // Only the former is worth offering to install jiti for.
      const jitiCanHelp = !canImportSchema || isLoaderError(nativeError) || !!getMissingCjsGlobal(nativeError) || isMissingExportError(nativeError)
      const jiti = await getSchemaJiti(jitiCanHelp)
      const failure = async () => ({
        filePath: displayPath,
        error: nativeError instanceof Error ? nativeError.message : String(nativeError),
        hint: describeNativeImportFailure(nativeError),
        installCommand: await installCommand(),
      })
      if (!jiti) {
        if (!canImportSchema) {
          configDiagnostics.NUXT_B5019({ filePath: displayPath, installCommand: await installCommand() })
        } else if (jitiCanHelp) {
          configDiagnostics.NUXT_B5036(await failure())
        } else {
          configDiagnostics.NUXT_B5005({ filePath: displayPath, cause: nativeError })
        }
        return
      }

      let loaded: SchemaDefinition
      try {
        // TODO: fix type for second argument of `import`
        loaded = await jiti.import(filePath, { default: true }) as SchemaDefinition
      } catch (jitiError) {
        configDiagnostics.NUXT_B5005({ filePath: displayPath, cause: jitiCanHelp ? jitiError : nativeError })
        return
      }
      if (canImportSchema && shouldReportJitiFallbackOnce(filePath, nuxt.options.rootDir, nuxt.options.future.compatibilityVersion)) {
        configDiagnostics.NUXT_B5037(await failure())
      }
      return loaded
    }

    // Register module types
    nuxt.hook('prepare:types', async (ctx) => {
      ctx.references.push({ path: 'schema/nuxt.schema.d.ts' })
      ctx.sharedReferences.push({ path: 'schema/nuxt.schema.d.ts' })
      ctx.nodeReferences.push({ path: 'schema/nuxt.schema.d.ts' })

      const typesDir = nuxt.options.typesDir || nuxt.options.buildDir
      ctx.nodeTsConfig.include ||= []
      ctx.nodeTsConfig.include.push(
        relative(typesDir, join(nuxt.options.rootDir, 'nuxt.schema.*')),
        relative(typesDir, join(nuxt.options.rootDir, 'layers/*/nuxt.schema.*')),
      )

      if (nuxt.options._prepare) {
        await writeSchema(schema)
      }
    })

    nuxt.hook('nitro:prepare:types', (ctx) => {
      ctx.references.push({ path: resolve(nuxt.options.buildDir, 'schema/nuxt.schema.d.ts') })
    })

    // Resolve schema after all modules initialized
    let schema: Schema
    nuxt.hook('modules:done', async () => {
      schema = await resolveSchema()
    })

    // Write schema after build to allow further modifications
    nuxt.hooks.hook('build:done', () => writeSchema(schema))

    const layerDirs = getLayerDirectories(nuxt)

    // Watch for schema changes in development mode
    if (nuxt.options.dev) {
      const onChange = debounce(async () => {
        schema = await resolveSchema()
        await writeSchema(schema)
      })

      if (nuxt.options.experimental.watcher === 'parcel') {
        try {
          const { subscribe } = await importModule<typeof import('@parcel/watcher')>('@parcel/watcher', {
            url: [nuxt.options.rootDir, ...nuxt.options.modulesDir].map(dir => directoryToURL(dir)),
          })
          for (const dirs of layerDirs) {
            const subscription = await subscribe(dirs.root, onChange, {
              ignore: ['!nuxt.schema.*'],
            })
            nuxt.hook('close', () => subscription.unsubscribe())
          }
          return
        } catch {
          configDiagnostics.NUXT_B5009({ installCommand: await getAddDependencyCommand('@parcel/watcher', nuxt.options.rootDir, { dev: true }) })
        }
      }

      const isIgnored = createIsIgnored(nuxt)
      const rootDirs = layerDirs.map(layer => layer.root)
      const SCHEMA_RE = /(?:^|\/)nuxt.schema.\w+$/
      const watcher = watch(rootDirs, {
        ...nuxt.options.watchers.chokidar,
        depth: 1,
        ignored: [
          (path, stats) => (stats && !stats.isFile()) || !SCHEMA_RE.test(path),
          isIgnored,
          /[\\/]node_modules[\\/]/,
        ],
        ignoreInitial: true,
      })
      watcher.on('all', onChange)
      nuxt.hook('close', () => watcher.close())
    }

    // --- utils ---

    async function resolveSchema () {
      // Global import
      // @ts-expect-error adding to globalThis for 'auto-import' support within nuxt.config file
      globalThis.defineNuxtSchema = defineNuxtSchema

      // Load schema from layers
      const schemaDefs: SchemaDefinition[] = [nuxt.options.$schema]
      for (const dirs of layerDirs) {
        const filePath = await resolver.resolvePath(join(dirs.root, 'nuxt.schema'))
        if (filePath && existsSync(filePath)) {
          const loaded = await loadSchemaFile(filePath)
          if (loaded) {
            schemaDefs.push(loaded)
          }
        }
      }

      // Allow hooking to extend custom schemas
      await nuxt.hooks.callHook('schema:extend', schemaDefs)

      // Resolve and merge schemas
      const schemas = await Promise.all(
        schemaDefs.map(schemaDef => resolveUntypedSchema(schemaDef)),
      )

      // Merge after normalization
      const schema = defu(...schemas as [Schema, Schema])

      // Allow hooking to extend resolved schema
      await nuxt.hooks.callHook('schema:resolved', schema)

      return schema
    }

    async function writeSchema (schema: Schema) {
      await nuxt.hooks.callHook('schema:beforeWrite', schema)
      // Write it to build dir
      await mkdir(resolve(nuxt.options.buildDir, 'schema'), { recursive: true })
      await writeFile(
        resolve(nuxt.options.buildDir, 'schema/nuxt.schema.json'),
        JSON.stringify(schema, null, 2),
        'utf8',
      )
      const _types = generateTypes(schema, {
        addExport: true,
        interfaceName: 'NuxtCustomSchema',
        partial: true,
        allowExtraKeys: false,
      })
      const types =
        _types +
        `
export type CustomAppConfig = Exclude<NuxtCustomSchema['appConfig'], undefined>
type _CustomAppConfig = CustomAppConfig

declare module '@nuxt/schema' {
  interface NuxtConfig extends Omit<NuxtCustomSchema, 'appConfig'> {}
  interface NuxtOptions extends Omit<NuxtCustomSchema, 'appConfig'> {}
  interface CustomAppConfig extends _CustomAppConfig {}
}

declare module 'nuxt/schema' {
  interface NuxtConfig extends Omit<NuxtCustomSchema, 'appConfig'> {}
  interface NuxtOptions extends Omit<NuxtCustomSchema, 'appConfig'> {}
  interface CustomAppConfig extends _CustomAppConfig {}
}
`
      const typesPath = resolve(nuxt.options.buildDir, 'schema/nuxt.schema.d.ts')
      await writeFile(typesPath, types, 'utf8')
      await nuxt.hooks.callHook('schema:written')
    }
  },
})
