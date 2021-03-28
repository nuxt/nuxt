import { promisify } from 'util'
import { resolve, relative, dirname } from 'path'
import Module from 'module'
import { writeFile, mkdir } from 'fs/promises'
import chalk from 'chalk'
import consola from 'consola'
import rimraf from 'rimraf'
import { RollupOptions, OutputOptions, OutputChunk, rollup } from 'rollup'
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import alias from '@rollup/plugin-alias'
import esbuild from 'rollup-plugin-esbuild'
import { mkdist } from 'mkdist'
import prettyBytes from 'pretty-bytes'

interface BuildEntry {
  name: string
  input: string
  output: string
  bundle: boolean
  format: 'esm' | 'cjs'
}

interface BuildContext {
  rootDir: string
  entries: BuildEntry[]
  externals: string[]
}

async function main () {
  const args = process.argv.splice(2)

  const ctx: BuildContext = {
    rootDir: resolve(args.shift() || '.'),
    entries: [],
    externals: [...Module.builtinModules]
  }

  const pkg = require(resolve(ctx.rootDir, 'package.json'))

  const buildOptions = pkg.build || {}
  if (buildOptions.entries) {
    if (!Array.isArray(buildOptions.entries)) {
      buildOptions.entries = Object.entries(buildOptions.entries)
    } ctx.entries.push(...buildOptions.entries.map(entry => resolveEntry(entry)))
  }
  if (pkg.dependencies) {
    ctx.externals.push(...Object.keys(pkg.dependencies))
  }

  await promisify(rimraf)(resolve(ctx.rootDir, 'dist'))

  if (args.includes('--stub')) {
    const stubbed: string[] = []
    for (const entry of ctx.entries) {
      if (entry.bundle) {
        const input = resolve(ctx.rootDir, entry.input)
        stubbed.push(entry.output)
        const output = resolve(ctx.rootDir, entry.output) + '.ts'
        await mkdir(dirname(output)).catch(() => { })
        await writeFile(output, entry.format === 'cjs'
          ? `module.exports = require('jiti')()('${input}')`
          : `export * from '${input}'`
        )
      }
    }
    consola.success(`Stub done: ${stubbed.join(', ')}`)
    return
  }

  consola.info(`${chalk.cyan(`Builduing ${pkg.name}`)}

${chalk.bold('Root dir:')} ${ctx.rootDir}
${chalk.bold('Entries:')}
${ctx.entries.map(entry => ' ' + dumpObject(entry)).join('\n')}
`)

  const rollupOptions = getRollupOptions(ctx)
  const buildResult = await rollup(rollupOptions)
  const outputOptions = rollupOptions.output as OutputOptions
  const { output } = await buildResult.write(outputOptions)

  const usedImports = new Set<string>()
  const buildEntries: { path: string, bytes?: number, exports?: string[], chunks?: string[] }[] = []

  for (const entry of output.filter(e => e.type === 'chunk') as OutputChunk[]) {
    for (const id of entry.imports) {
      usedImports.add(id)
    }
    if (entry.isEntry) {
      buildEntries.push({
        path: entry.fileName,
        bytes: entry.code.length * 4,
        exports: entry.exports
      })
    }
  }

  for (const entry of ctx.entries.filter(e => !e.bundle)) {
    const { writtenFiles } = await mkdist({
      rootDir: ctx.rootDir,
      srcDir: entry.input,
      distDir: entry.output,
      format: entry.format
    })
    buildEntries.push({
      path: entry.output,
      bytes: 0,
      chunks: writtenFiles.map(p => relative(resolve(ctx.rootDir, entry.output), p))
    })
  }

  consola.success(`${chalk.green('Build succeed')}\n
${buildEntries.map(entry => `${chalk.bold(entry.path)}
  size: ${chalk.cyan(entry.bytes ? prettyBytes(entry.bytes) : '-')}
  exports: ${chalk.gray(entry.exports ? entry.exports.join(', ') : '-')}
  chunks: ${chalk.gray(entry.chunks ? entry.chunks.join(', ') : '-')}`
  ).join('\n')}`)

  const usedDependencies = new Set<string>()
  const unusedDependencies = new Set<string>(Object.keys(pkg.dependencies || {}))
  const implicitDependnecies = new Set<string>()
  for (const id of usedImports) {
    unusedDependencies.delete(id)
    usedDependencies.add(id)
  }
  if (Array.isArray(buildOptions.dependencies)) {
    for (const id of buildOptions.dependencies) {
      unusedDependencies.delete(id)
    }
  }
  for (const id of usedDependencies) {
    if (
      !ctx.externals.includes(id) &&
      !id.startsWith('chunks/') &&
      !ctx.externals.includes(id.split('/')[0]) // lodash/get
    ) {
      implicitDependnecies.add(id)
    }
  }
  if (unusedDependencies.size) {
    consola.warn('Potential unused dependencies found:', Array.from(unusedDependencies).map(id => chalk.cyan(id)).join(', '))
  }
  if (implicitDependnecies.size) {
    consola.warn('Potential implicit dependencies found:', Array.from(implicitDependnecies).map(id => chalk.cyan(id)).join(', '))
  }
}

function resolveEntry (input: string | [string, Partial<BuildEntry>] | Partial<BuildEntry>): BuildEntry {
  let entry: Partial<BuildEntry>
  if (typeof input === 'string') {
    entry = { name: input }
  }
  if (Array.isArray(input)) {
    entry = { name: input[0], ...input[1] }
  }
  entry.input = entry.input ?? `src/${entry.name}`
  entry.output = entry.output ?? `dist/${entry.name}`
  entry.bundle = entry.bundle ?? !entry.input.endsWith('/')
  entry.format = entry.format ?? 'esm'
  return entry as BuildEntry
}

function dumpObject (obj) {
  return '{ ' + Object.keys(obj).map(key => `${key}: ${JSON.stringify(obj[key])}`).join(', ') + ' }'
}

function getRollupOptions (ctx: BuildContext): RollupOptions {
  const extensions = ['.ts', '.mjs', '.js', '.json']

  const r = (...path) => resolve(ctx.rootDir, ...path)

  return <RollupOptions>{
    input: ctx.entries.filter(e => e.bundle).map(e => e.input),

    output: {
      dir: r('dist'),
      format: 'cjs',
      chunkFileNames: 'chunks/[hash].js',
      exports: 'auto',
      preferConst: true
    },

    external (id) {
      if (id[0] === '.' || id.includes('src/')) {
        return false
      }
      return !!ctx.externals.find(ext => id.includes(ext))
    },

    plugins: [
      alias({
        entries: {
          src: resolve(__dirname, 'src')
        }
      }),

      nodeResolve({
        extensions
      }),

      esbuild({
        target: 'node12',
        loaders: {
          '.json': 'json'
        }
      }),

      commonjs({
        extensions
      })
    ]
  }
}

main().catch(consola.error)
