import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'pathe'
import { watch } from 'chokidar'
import { defu } from 'defu'
import { debounce } from 'perfect-debounce'
import { createResolver, defineNuxtModule, importModule, logger, tryResolveModule } from '@nuxt/kit'
import {
  generateTypes,
  resolveSchema as resolveUntypedSchema,
} from 'untyped'
import type { Schema, SchemaDefinition } from 'untyped'
import untypedPlugin from 'untyped/babel-plugin'
import { createJiti } from 'jiti'

export default defineNuxtModule({
  meta: {
    name: 'nuxt:nuxt-config-schema',
  },
  async setup (_, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Initialize untyped/jiti loader
    const _resolveSchema = createJiti(fileURLToPath(import.meta.url), {
      cache: false,
      transformOptions: {
        babel: {
          plugins: [untypedPlugin],
        },
      },
    })

    // Register module types
    nuxt.hook('prepare:types', async (ctx) => {
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
      const onChange = debounce(async () => {
        schema = await resolveSchema()
        await writeSchema(schema)
      })

      if (nuxt.options.experimental.watcher === 'parcel') {
        const watcherPath = await tryResolveModule('@parcel/watcher', [nuxt.options.rootDir, ...nuxt.options.modulesDir])
        if (watcherPath) {
          const { subscribe } = await importModule<typeof import('@parcel/watcher')>(watcherPath)
          for (const layer of nuxt.options._layers) {
            const subscription = await subscribe(layer.config.rootDir, onChange, {
              ignore: ['!nuxt.schema.*'],
            })
            nuxt.hook('close', () => subscription.unsubscribe())
          }
          return
        }
        logger.warn('Falling back to `chokidar` as `@parcel/watcher` cannot be resolved in your project.')
      }

      const filesToWatch = await Promise.all(nuxt.options._layers.map(layer =>
        resolver.resolve(layer.config.rootDir, 'nuxt.schema.*'),
      ))
      const watcher = watch(filesToWatch, {
        ...nuxt.options.watchers.chokidar,
        ignoreInitial: true,
      })
      watcher.on('all', onChange)
      nuxt.hook('close', () => watcher.close())
    }

    // --- utils ---

    async function resolveSchema () {
      // Global import
      // @ts-expect-error adding to globalThis for 'auto-import' support within nuxt.config file
      globalThis.defineNuxtSchema = (val: any) => val

      // Load schema from layers
      const schemaDefs: SchemaDefinition[] = [nuxt.options.$schema]
      for (const layer of nuxt.options._layers) {
        const filePath = await resolver.resolvePath(resolve(layer.config.rootDir, 'nuxt.schema'))
        if (filePath && existsSync(filePath)) {
          let loadedConfig: SchemaDefinition
          try {
            // TODO: fix type for second argument of `import`
            loadedConfig = await _resolveSchema.import(filePath, { default: true }) as SchemaDefinition
          } catch (err) {
            logger.warn(
              'Unable to load schema from',
              filePath,
              err,
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
      const typesPath = resolve(
        nuxt.options.buildDir,
        'schema/nuxt.schema.d.ts',
      )
      await writeFile(typesPath, types, 'utf8')
      await nuxt.hooks.callHook('schema:written')
    }
  },
})
