import { existsSync } from 'node:fs'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'pathe'
import chokidar from 'chokidar'
import { defu } from 'defu'
import { debounce } from 'perfect-debounce'
import { defineNuxtModule, createResolver } from '@nuxt/kit'
import {
  resolveSchema as resolveUntypedSchema,
  generateTypes
} from 'untyped'
import type { Schema, SchemaDefinition } from 'untyped'
// @ts-ignore
import untypedPlugin from 'untyped/babel-plugin'
import jiti from 'jiti'

export default defineNuxtModule({
  meta: {
    name: 'nuxt-config-schema'
  },
  async setup (_, nuxt) {
    if (!nuxt.options.experimental.configSchema) {
      return
    }
    const resolver = createResolver(import.meta.url)

    // Initialize untyped/jiti loader
    const _resolveSchema = jiti(dirname(import.meta.url), {
      esmResolve: true,
      interopDefault: true,
      cache: false,
      requireCache: false,
      transformOptions: {
        babel: {
          plugins: [untypedPlugin]
        }
      }
    })

    // Register module types
    nuxt.hook('prepare:types', async (ctx) => {
      ctx.references.push({ path: 'nuxt-config-schema' })
      ctx.references.push({ path: 'schema/nuxt.schema.d.ts' })
      if (nuxt.options._prepare) {
        await writeSchema(schema)
      }
    })

    // Resolve schema after all modules initialized
    let schema: Schema
    nuxt.hook('modules:done', async () => {
      schema = await resolveSchema()
    })

    // Write schema after build to allow further modifications
    nuxt.hooks.hook('build:done', () => writeSchema(schema))

    // Watch for schema changes in development mode
    if (nuxt.options.dev) {
      const filesToWatch = await Promise.all(nuxt.options._layers.map(layer =>
        resolver.resolve(layer.config.rootDir, 'nuxt.schema.*')
      ))
      const watcher = chokidar.watch(filesToWatch, {
        ...nuxt.options.watchers.chokidar,
        ignoreInitial: true
      })
      const onChange = debounce(async () => {
        schema = await resolveSchema()
        await writeSchema(schema)
      })
      watcher.on('all', onChange)
      nuxt.hook('close', () => watcher.close())
    }

    // --- utils ---

    async function resolveSchema () {
      // Global import
      // @ts-ignore
      globalThis.defineNuxtSchema = (val: any) => val

      // Load schema from layers
      const schemaDefs: SchemaDefinition[] = [nuxt.options.$schema]
      for (const layer of nuxt.options._layers) {
        const filePath = await resolver.resolvePath(resolve(layer.config.rootDir, 'nuxt.schema'))
        if (filePath && existsSync(filePath)) {
          let loadedConfig: SchemaDefinition
          try {
            loadedConfig = _resolveSchema(filePath)
          } catch (err) {
            console.warn(
              '[nuxt-config-schema] Unable to load schema from',
              filePath,
              err
            )
            continue
          }
          schemaDefs.push(loadedConfig)
        }
      }

      // Allow hooking to extend custom schemas
      await nuxt.hooks.callHook('schema:extend', schemaDefs)

      // Resolve and merge schemas
      const schemas = await Promise.all(
        schemaDefs.map(schemaDef => resolveUntypedSchema(schemaDef))
      )

      // @ts-expect-error
      // Merge after normalization
      const schema = defu(...schemas)

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
        'utf8'
      )
      const _types = generateTypes(schema, {
        addExport: true,
        interfaceName: 'NuxtCustomSchema',
        partial: true
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
      const typesPath = resolve(
        nuxt.options.buildDir,
        'schema/nuxt.schema.d.ts'
      )
      await writeFile(typesPath, types, 'utf8')
      await nuxt.hooks.callHook('schema:written')
    }
  }
})
