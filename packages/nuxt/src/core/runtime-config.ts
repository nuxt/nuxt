import { tryImportModule } from '@nuxt/kit'
import type { Nuxt, NuxtTemplate, RuntimeConfig } from '@nuxt/schema'
import { dirname, resolve } from 'pathe'
import type ts from 'typescript'
import { type JSValue, generateTypes, resolveSchema } from 'untyped'
import { GenMapping, addMapping, toEncodedMap } from '@jridgewell/gen-mapping'

export function useRuntimeConfigTemplates () {
  let resolve: (map: GenMapping) => void
  const promise = new Promise<GenMapping>((_resolve) => {
    resolve = _resolve
  })

  const runtimeConfigTemplate: NuxtTemplate = {
    filename: 'types/runtime-config.d.ts',
    getContents: async ({ nuxt }) => {
      const privateRuntimeConfig = Object.create(null)
      for (const key in nuxt.options.runtimeConfig) {
        if (key !== 'public') {
          privateRuntimeConfig[key] = nuxt.options.runtimeConfig[key]
        }
      }

      let codegen: Generator<Code>

      const ts = await tryImportModule<typeof import('typescript')>('typescript')
      if (ts) {
        codegen = generate(generateWithTypeScript(nuxt, ts, nuxt.options.runtimeConfig))
      } else {
        codegen = generate([
          generateTypes(await resolveSchema(privateRuntimeConfig as Record<string, JSValue>),
            {
              interfaceName: 'SharedRuntimeConfig',
              addExport: false,
              addDefaults: false,
              allowExtraKeys: false,
              indentation: 2,
            }),
          '\n',
          generateTypes(await resolveSchema(nuxt.options.runtimeConfig.public as Record<string, JSValue>),
            {
              interfaceName: 'SharedPublicRuntimeConfig',
              addExport: false,
              addDefaults: false,
              allowExtraKeys: false,
              indentation: 2,
            }),
        ])
      }

      let contents = ''
      let line = 1
      let column = 0
      const map = new GenMapping({
        file: 'runtime-config.d.ts',
      })

      for (const code of codegen) {
        let str: string
        if (typeof code === 'object') {
          const [text, meta] = code
          for (const range of meta.ranges) {
            addMapping(map, {
              generated: {
                line,
                column,
              },
              source: range.fileName,
              original: {
                line: range.start.line + 1,
                column: range.start.character,
              },
              name: text,
            })
            addMapping(map, {
              generated: {
                line,
                column: column + text.length,
              },
              source: range.fileName,
              original: {
                line: range.end.line + 1,
                column: range.end.character,
              },
            })
          }
          str = text
        } else {
          str = code
        }
        contents += str
        line += str.split('\n').length - 1
        column = contents.split('\n').pop()?.length ?? 0
      }
      resolve(map)

      return contents
    },
  }

  const runtimeConfigMappingTemplate: NuxtTemplate = {
    filename: 'types/runtime-config.d.ts.map',
    write: true,
    getContents: async () => {
      const map = await promise
      return JSON.stringify(toEncodedMap(map))
    },
  }

  return {
    runtimeConfigTemplate,
    runtimeConfigMappingTemplate,
  }
}

type Code = string | [string, Meta]

function* generate (generator: Generator<Code> | Code[]): Generator<Code> {
  yield `import { RuntimeConfig as UserRuntimeConfig, PublicRuntimeConfig as UserPublicRuntimeConfig } from 'nuxt/schema'\n`

  yield* generator

  yield `
declare module '@nuxt/schema' {
  interface RuntimeConfig extends UserRuntimeConfig {}
  interface PublicRuntimeConfig extends UserPublicRuntimeConfig {}
}
declare module 'nuxt/schema' {
  interface RuntimeConfig extends UserRuntimeConfig {}
  interface PublicRuntimeConfig extends UserPublicRuntimeConfig {}
}
declare module 'vue' {
  interface ComponentCustomProperties {
    $config: UserRuntimeConfig
  }
}`
}

const MetaSymbol = Symbol('meta')

interface Meta {
  ranges: Range[]
  types?: Set<string>
}

interface Item extends Record<string, Item> {
  [MetaSymbol]: Meta
}

interface Range {
  fileName: string
  start: ts.LineAndCharacter
  end: ts.LineAndCharacter
}

function* generateWithTypeScript (
  nuxt: Nuxt,
  ts: typeof import('typescript'),
  runtimeConfig: RuntimeConfig,
): Generator<Code> {
  const configDir = resolve(nuxt.options.buildDir, 'tsconfig.node.json')
  const configFile = ts.readConfigFile(configDir, ts.sys.readFile)
  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configDir))
  const host = ts.createCompilerHost(parsedConfig.options)

  const { readFile } = host
  host.readFile = (fileName: string) => {
    if (fileName.endsWith('runtime-config.d.ts')) {
      return ''
    }
    const file = readFile?.call(host, fileName)
    if (fileName === nuxt.options._nuxtConfigFile) {
      return `${file}
const __nuxt_runtime_config__ = ${JSON.stringify(runtimeConfig, null, 2)}
declare function defineNuxtConfig<T>(config: T): T & {
  runtimeConfig: import('nuxt/schema').RuntimeConfig & typeof __nuxt_runtime_config__
}
`
    }
    return file
  }

  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
    host,
  })

  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(nuxt.options._nuxtConfigFile)
  if (!sourceFile) {
    return
  }

  let config: Record<string, Item> | undefined

  sourceFile.forEachChild((node) => {
    if (ts.isExportAssignment(node)) {
      const type = checker.getTypeAtLocation(node.expression)
      const properties = type.getProperties()
      const symbol = properties.find(p => p.name === 'runtimeConfig')
      if (symbol) {
        const type = checker.getTypeOfSymbol(symbol)
        config = accessTypes(type)
      }
    }
  })

  if (config) {
    const publicConfig = config.public
    delete config.public
    yield `interface SharedRuntimeConfig `
    yield* generateObject(config)
    yield '\n'
    yield `interface SharedPublicRuntimeConfig `
    yield* generateObject(publicConfig ?? {})
    yield '\n'
  }

  function accessTypes (type: ts.Type) {
    const result: Record<string, Item> = {}

    for (const property of type.getNonNullableType().getProperties()) {
      for (const declaration of property.getDeclarations() ?? []) {
        const symbol = (declaration as any).symbol as ts.Symbol | undefined
        if (!symbol || symbol.escapedName === ts.InternalSymbolName.Computed) { continue }

        const name = symbol.getName()
        result[name] ??= {
          [MetaSymbol]: {
            ranges: [],
          },
        }

        const sourceFile = declaration.getSourceFile()
        if (ts.isPropertyAssignment(declaration) || ts.isPropertySignature(declaration)) {
          result[name][MetaSymbol].ranges.push({
            fileName: sourceFile.fileName,
            start: sourceFile.getLineAndCharacterOfPosition(declaration.name.getStart()),
            end: sourceFile.getLineAndCharacterOfPosition(declaration.name.end),
          })
        }

        const propType = checker.getTypeOfSymbolAtLocation(property, declaration).getNonNullableType()
        if (isObjectLike(propType)) {
          Object.assign(result[name], accessTypes(propType))
        } else {
          const type = checker.typeToString(propType, void 0, ts.TypeFormatFlags.InTypeAlias)
          ;(result[name][MetaSymbol].types ??= new Set()).add(type)
        }
      }
    }

    return result
  }

  function isObjectLike (type: ts.Type): type is ts.ObjectType {
    if (type.isUnionOrIntersection()) {
      return type.types.some(isObjectLike)
    }
    return (type.flags & ts.TypeFlags.Object) !== 0
  }
}

function* generateObject (obj: Record<string, Item>): Generator<Code> {
  yield `{\n`
  for (const [key, value] of Object.entries(obj)) {
    const meta = value[MetaSymbol]
    yield `  `
    yield [key, meta]
    yield `: `
    if (meta.types) {
      yield [...meta.types].join(' | ')
    } else {
      yield* generateObject(value)
    }
    yield `\n`
  }
  yield `}`
}
