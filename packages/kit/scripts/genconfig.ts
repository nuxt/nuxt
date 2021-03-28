import { resolve } from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { resolveSchema, generateTypes, generateMarkdown } from 'untyped'

async function main () {
  const genDir = resolve(__dirname, '../dist/config')
  const srcConfig = await import('../src/config/schema').then(r => r.default)

  const defaults = { rootDir: '/<dir>/' }
  const schema = resolveSchema(srcConfig, defaults)

  await mkdir(genDir).catch(() => { })
  await writeFile(resolve(genDir, 'config.md'), generateMarkdown(schema))
  await writeFile(resolve(genDir, 'schema.json'), JSON.stringify(schema, null, 2))
  await writeFile(resolve(genDir, 'defaults.json'), JSON.stringify(defaults, null, 2))
  await writeFile(resolve(genDir, 'config.d.ts'), 'export default ' + generateTypes(schema, 'Config'))
}

main().catch(console.error)
