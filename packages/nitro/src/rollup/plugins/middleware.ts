import hasha from 'hasha'
import virtual from '@rollup/plugin-virtual'
import type { ServerMiddleware } from '../../context'

export function middleware (middleware: ServerMiddleware[]) {
  const getImportId = p => '_' + hasha(p).substr(0, 6)

  return virtual({
    '~serverMiddleware': `
${middleware.filter(m => m.lazy === false).map(m => `import ${getImportId(m.handle)} from '${m.handle}';`).join('\n')}

${middleware.filter(m => m.lazy !== false).map(m => `const ${getImportId(m.handle)} = () => import('${m.handle}');`).join('\n')}

const middleware = [
  ${middleware.map(m => `{ route: '${m.route}', handle: ${getImportId(m.handle)}, lazy: ${m.lazy || true}, promisify: ${m.promisify !== undefined ? m.promisify : true} }`).join(',\n')}
];

export default middleware
`
  })
}
