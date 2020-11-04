import { resolve } from 'path'
import globby, { GlobbyOptions } from 'globby'

const PLUGIN_NAME = 'dynamic-require'
const HELPER_DYNAMIC = `\0${PLUGIN_NAME}.js`
const DYNAMIC_REQUIRE_RE = /require\("\.\/" \+/g

function CJSTemplate ({ imports }) {
  return `${imports.map(i => `import ${i.name} from '${i.import}'`).join('\n')}
const dynamicChunks = {
  ${imports.map(i => ` ['${i.id}']: ${i.name}`).join(',\n')}
};

export default function dynamicRequire(id) {
  return dynamicChunks[id];
};`
}

interface Options {
  dir: string,
  globbyOptions: GlobbyOptions
}

export default function dynamicRequire ({ dir, globbyOptions }: Options) {
  return {
    name: PLUGIN_NAME,
    transform (code, _id) {
      return code.replace(DYNAMIC_REQUIRE_RE, `require('${HELPER_DYNAMIC}')(`)
    },
    resolveId (id) {
      return id === HELPER_DYNAMIC ? id : null
    },
    async load (id) {
      if (id === HELPER_DYNAMIC) {
        const files = await globby('**/*.js', { cwd: dir, absolute: false, ...globbyOptions })
        const imports = files.map(id => ({
          id,
          import: resolve(dir, id),
          name: id.replace(/[\\/.]/g, '_')
        }))
        return CJSTemplate({ imports })
      }
      return null
    }
  }
}
