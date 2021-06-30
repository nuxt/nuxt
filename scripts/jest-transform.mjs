import { transformSync } from 'esbuild'

// https://jestjs.io/docs/next/code-transformation
export default {
  process (src, path, _opts) {
    const r = transformSync(src, {
      target: 'node14',
      format: 'cjs',
      sourcefile: path,
      loader: path.endsWith('.ts') ? 'ts' : 'default'
    })
    r.code = r.code.replace(/import(\(.*\))/g, (_, id) => {
      let openBrackets = 0

      for (let pos = 0; pos < id.length; pos++) {
        const char = id[pos]
        switch (char) {
          case '(':
            openBrackets++
            break
          case ')':
            openBrackets--
            if (!openBrackets) {
              return 'Promise.resolve(require' + id.slice(0, pos) + ')' + id.slice(pos)
            }
            break
        }
      }
      return 'Promise.resolve(require' + id + ')'
    })
    return r
  }
}
