import type { Nuxt, NuxtTemplate } from '@nuxt/schema'
import type ts from 'typescript'
import { type JSValue, generateTypes, resolveSchema } from 'untyped'

export const runtimeConfigTemplate: NuxtTemplate = {
  filename: 'types/runtime-config.d.ts',
  getContents: async ({ nuxt }) => {
    const privateRuntimeConfig = Object.create(null)
    for (const key in nuxt.options.runtimeConfig) {
      if (key !== 'public') {
        privateRuntimeConfig[key] = nuxt.options.runtimeConfig[key]
      }
    }

    let str: string | undefined

    if (nuxt._ts && nuxt._program) {
      str = [...generateWithTypeScript(nuxt)].join('')
    } else {
      str =
        generateTypes(await resolveSchema(privateRuntimeConfig as Record<string, JSValue>),
          {
            interfaceName: 'SharedRuntimeConfig',
            addExport: false,
            addDefaults: false,
            allowExtraKeys: false,
            indentation: 2,
          }) + '\n' +
        generateTypes(await resolveSchema(nuxt.options.runtimeConfig.public as Record<string, JSValue>),
          {
            interfaceName: 'SharedPublicRuntimeConfig',
            addExport: false,
            addDefaults: false,
            allowExtraKeys: false,
            indentation: 2,
          })
    }

    return [
      `import { RuntimeConfig as UserRuntimeConfig, PublicRuntimeConfig as UserPublicRuntimeConfig } from 'nuxt/schema'`,
      str,
      `declare module '@nuxt/schema' {`,
      `  interface RuntimeConfig extends UserRuntimeConfig {}`,
      `  interface PublicRuntimeConfig extends UserPublicRuntimeConfig {}`,
      `}`,
      `declare module 'nuxt/schema' {`,
      `  interface RuntimeConfig extends SharedRuntimeConfig {}`,
      `  interface PublicRuntimeConfig extends SharedPublicRuntimeConfig {}`,
      '}',
      `declare module 'vue' {
        interface ComponentCustomProperties {
          $config: UserRuntimeConfig
        }
      }`,
    ].join('\n')
  },
}

const MetaSymbol = Symbol('meta')

interface Item extends Record<string, Item> {
  [MetaSymbol]: {
    ranges: Range[]
    types?: string[]
  }
}

interface Range {
  fileName: string
  start: ts.LineAndCharacter
  end: ts.LineAndCharacter
}

function* generateWithTypeScript (nuxt: Nuxt) {
  const ts = nuxt._ts!
  const program = nuxt._program!

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
        config = accessTypes(type, ['app', 'nitro'])
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
  }

  function accessTypes (type: ts.Type, excluded?: string[]) {
    const result: Record<string, Item> = {}

    for (const property of type.getNonNullableType().getProperties()) {
      for (const declaration of property.getDeclarations() ?? []) {
        const sourceFile = declaration.getSourceFile()
        const { fileName } = sourceFile
        if (fileName.endsWith('types/runtime-config.d.ts')) { continue }

        const symbol = (declaration as any).symbol as ts.Symbol | undefined
        if (!symbol || symbol.escapedName === ts.InternalSymbolName.Computed) { continue }

        const name = symbol.getName()
        if (excluded?.includes(name)) { continue }

        result[name] ??= {
          [MetaSymbol]: {
            ranges: [],
          },
        }

        if (ts.isPropertyAssignment(declaration) || ts.isPropertySignature(declaration)) {
          result[name][MetaSymbol].ranges.push({
            fileName: sourceFile.fileName,
            start: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()),
            end: sourceFile.getLineAndCharacterOfPosition(declaration.end),
          })
        }

        const propType = checker.getTypeOfSymbolAtLocation(property, declaration).getNonNullableType()
        if (isObjectLike(propType)) {
          Object.assign(result[name], accessTypes(propType))
        } else {
          const type = printType(propType)
          ;(result[name][MetaSymbol].types ??= []).push(type)
        }
      }
    }

    return result
  }

  function isObjectLike (type: ts.Type): type is ts.ObjectType {
    if (type.isUnionOrIntersection()) {
      return type.types.some(isObjectLike)
    }
    if (type.flags & ts.TypeFlags.Object) {
      return !type.getProperties().some(p => p.name.startsWith('__@message@'))
    }
    return false
  }

  function printType (type: ts.Type) {
    const str = checker.typeToString(type, void 0, ts.TypeFormatFlags.InTypeAlias)
    return str.replace(/ & \{ \[message\]\?:.*?\| undefined; \}$/g, '')
  }
}

function* generateObject (obj: Record<string, Item>): Generator<string> {
  yield `{\n`
  for (const [key, value] of Object.entries(obj)) {
    const meta = value[MetaSymbol]
    yield `  ${key}: `
    if (meta.types) {
      yield meta.types.join(' | ')
    } else {
      yield* generateObject(value)
    }
    yield `\n`
  }
  yield `}`
}
