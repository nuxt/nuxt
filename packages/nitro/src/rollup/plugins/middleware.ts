import hasha from 'hasha'
import { relative } from 'pathe'
import table from 'table'
import isPrimitive from 'is-primitive'
import { isDebug } from 'std-env'
import { genArrayFromRaw, genDynamicImport, genImport } from 'knitwork'
import type { ServerMiddleware } from '../../server/middleware'
import virtual from './virtual'

const unique = (arr: any[]) => Array.from(new Set(arr))

export function middleware (getMiddleware: () => ServerMiddleware[]) {
  const getImportId = p => '_' + hasha(p).slice(0, 6)

  let lastDump = ''

  return virtual({
    '#server-middleware': {
      load: () => {
        const middleware = getMiddleware()

        if (isDebug) {
          const dumped = dumpMiddleware(middleware)
          if (dumped !== lastDump) {
            lastDump = dumped
            if (middleware.length) {
              console.log(dumped)
            }
          }
        }

        // Imports take priority
        const imports = unique(middleware.filter(m => m.lazy === false).map(m => m.handle))

        // Lazy imports should fill in the gaps
        const lazyImports = unique(middleware.filter(m => m.lazy !== false && !imports.includes(m.handle)).map(m => m.handle))

        return `
${imports.map(handle => `${genImport(handle, getImportId(handle))};`).join('\n')}

${lazyImports.map(handle => `const ${getImportId(handle)} = ${genDynamicImport(handle)};`).join('\n')}

const middleware = ${genArrayFromRaw(middleware.map(m => ({
  route: JSON.stringify(m.route),
  handle: getImportId(m.handle),
  lazy: m.lazy || true,
  promisify: m.promisify !== undefined ? m.promisify : true
})))};

export default middleware
  `
      }
    }
  })
}

function dumpMiddleware (middleware: ServerMiddleware[]) {
  const data = middleware.map(({ route, handle, ...props }) => {
    return [
      (route && route !== '/') ? route : '*',
      relative(process.cwd(), handle as string),
      dumpObject(props)
    ]
  })
  return table.table([
    ['Route', 'Handle', 'Options'],
    ...data
  ], {
    singleLine: true,
    border: table.getBorderCharacters('norc')
  })
}

function dumpObject (obj: any) {
  const items = []
  for (const key in obj) {
    const val = obj[key]
    items.push(`${key}: ${isPrimitive(val) ? val : JSON.stringify(val)}`)
  }
  return items.join(', ')
}
