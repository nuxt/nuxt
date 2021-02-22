import hasha from 'hasha'
import { relative } from 'upath'
import { table, getBorderCharacters } from 'table'
import isPrimitive from 'is-primitive'
import stdenv from 'std-env'
import type { ServerMiddleware } from '../../server/middleware'
import virtual from './virtual'

export function middleware (getMiddleware: () => ServerMiddleware[]) {
  const getImportId = p => '_' + hasha(p).substr(0, 6)

  let lastDump = ''

  return virtual({
    '~serverMiddleware': () => {
      const middleware = getMiddleware()

      if (!stdenv.test) {
        const dumped = dumpMiddleware(middleware)
        if (dumped !== lastDump) {
          lastDump = dumped
          if (middleware.length) {
            console.log('\n\nNitro middleware:\n' + dumped)
          }
        }
      }

      return `
${middleware.filter(m => m.lazy === false).map(m => `import ${getImportId(m.handle)} from '${m.handle}';`).join('\n')}

${middleware.filter(m => m.lazy !== false).map(m => `const ${getImportId(m.handle)} = () => import('${m.handle}');`).join('\n')}

const middleware = [
  ${middleware.map(m => `{ route: '${m.route}', handle: ${getImportId(m.handle)}, lazy: ${m.lazy || true}, promisify: ${m.promisify !== undefined ? m.promisify : true} }`).join(',\n')}
];

export default middleware
`
    }
  })
}

function dumpMiddleware (middleware: ServerMiddleware[]) {
  const data = middleware.map(({ route, handle, ...props }) => {
    return [
      (route && route !== '/') ? route : '[global]',
      relative(process.cwd(), handle),
      dumpObject(props)
    ]
  })
  return table([
    ['Route', 'Handle', 'Options'],
    ...data
  ], {
    border: getBorderCharacters('norc')
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
