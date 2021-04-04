import { promisify } from 'util'
import { resolve, relative, dirname } from 'path'
import Module from 'module'
import { writeFile, mkdir, unlink, symlink } from 'fs/promises'
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
import execa from 'execa'
import dts from 'rollup-plugin-dts'

interface BuildEntry {
  name: string
  input: string
  output: string
  bundle: boolean
  srcDir: string
  distDir: string
  format: 'esm' | 'cjs'
}

interface BuildContext {
  rootDir: string
  entries: BuildEntry[]
  externals: string[]
}

export async function build (rootDir: string, stub: boolean) {
  const ctx: BuildContext = {
    rootDir,
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
  if (buildOptions.externals) {
    ctx.externals.push(...buildOptions.externals)
  }

  const distDir = resolve(ctx.rootDir, 'dist')
  await unlink(distDir).catch(() => {})
  await promisify(rimraf)(distDir)

  if (buildOptions.prebuild) {
    const [cmd, ...args] = buildOptions.prebuild.split(' ')
    await execa(cmd, args)
  }

  if (stub) {
    const stubbed: string[] = []
    for (const entry of ctx.entries) {
      if (entry.bundle) {
        const input = resolve(ctx.rootDir, entry.input)
        stubbed.push(entry.output)
        const output = resolve(ctx.rootDir, entry.output) + '.js'
        await mkdir(dirname(output)).catch(() => { })
        const cjsStub = `module.exports = require('jiti')()('${input}')`
        const esStub = `export * from '${input}'`
        await writeFile(output, entry.format === 'cjs' ? cjsStub : esStub)
        await writeFile(output.replace('.js', '.d.ts'), esStub)
      } else {
        const outDir = resolve(ctx.rootDir, entry.output)
        const srcDir = resolve(ctx.rootDir, entry.input)
        await unlink(outDir).catch(() => { })
        await symlink(srcDir, outDir)
      }
    }
    return
  }

  consola.info(chalk.cyan(`Builduing ${pkg.name}`))
  if (process.env.DEBUG) {
    consola.info(`
  ${chalk.bold('Root dir:')} ${ctx.rootDir}
  ${chalk.bold('Entries:')}
  ${ctx.entries.map(entry => ' ' + dumpObject(entry)).join('\n')}
`)
  }

  const rollupOptions = getRollupOptions(ctx)
  const buildEntries: { path: string, bytes?: number, exports?: string[], chunks?: string[] }[] = []
  const usedImports = new Set<string>()
  if (rollupOptions) {
    const buildResult = await rollup(rollupOptions)
    const outputOptions = rollupOptions.output as OutputOptions
    const { output } = await buildResult.write(outputOptions)

    for (const entry of output.filter(e => e.type === 'chunk') as OutputChunk[]) {
      for (const id of entry.imports) {
        usedImports.add(id)
      }
      if (entry.isEntry) {
        buildEntries.push({
          path: relative(ctx.rootDir, resolve(outputOptions.dir, entry.fileName)),
          bytes: entry.code.length * 4,
          exports: entry.exports
        })
      }
    }

    // Types
    rollupOptions.plugins.push(dts())
    const typesBuild = await rollup(rollupOptions)
    await typesBuild.write(outputOptions)
  }

  for (const entry of ctx.entries.filter(e => !e.bundle)) {
    const { writtenFiles } = await mkdist({
      rootDir: ctx.rootDir,
      srcDir: entry.input,
      distDir: entry.output,
      format: entry.format
    })
    buildEntries.push({
      path: relative(ctx.rootDir, entry.output),
      chunks: [`${writtenFiles.length} files`]
    })
  }

  consola.success(chalk.green('Build succeed for ' + pkg.name))
  for (const entry of buildEntries) {
    consola.log(`  ${chalk.bold(entry.path)} (` + [
      entry.bytes && `size: ${chalk.cyan(prettyBytes(entry.bytes))}`,
      entry.exports && `exports: ${chalk.gray(entry.exports.join(', '))}`,
      entry.chunks && `chunks: ${chalk.gray(entry.chunks.join(', '))}`
    ].filter(Boolean).join(', ') + ')')
  }

  if (rollupOptions) {
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

  consola.log('')
}

function resolveEntry (input: string | [string, Partial<BuildEntry>] | Partial<BuildEntry>): BuildEntry {
  let entry: Partial<BuildEntry>
  if (typeof input === 'string') {
    entry = { name: input }
  }
  if (Array.isArray(input)) {
    entry = { name: input[0], ...input[1] }
  }
  entry.input = entry.input ?? resolve(entry.srcDir || 'src', './' + entry.name)
  entry.output = entry.output ?? resolve(entry.distDir || 'dist', './' + entry.name)
  entry.bundle = entry.bundle ?? !(entry.input.endsWith('/') || entry.name.endsWith('/'))
  entry.format = entry.format ?? 'esm'
  return entry as BuildEntry
}

function dumpObject (obj) {
  return '{ ' + Object.keys(obj).map(key => `${key}: ${JSON.stringify(obj[key])}`).join(', ') + ' }'
}

function getRollupOptions (ctx: BuildContext): RollupOptions | null {
  const extensions = ['.ts', '.mjs', '.js', '.json']

  const r = (...path) => resolve(ctx.rootDir, ...path)

  const entries = ctx.entries.filter(e => e.bundle)
  if (!entries.length) {
    return null
  }

  return <RollupOptions>{
    input: entries.map(e => e.input),

    output: {
      dir: r('dist'),
      format: 'cjs',
      chunkFileNames: 'chunks/[hash].js',
      exports: 'auto',
      preferConst: true
    },

    external (id) {
      if (id[0] === '.' || id[0] === '/' || id.includes('src/')) {
        return false
      }
      const isExplicitExternal = !!ctx.externals.find(ext => id.includes(ext))
      if (!isExplicitExternal) {
        consola.warn(`Inlining external ${id}`)
      }
      return isExplicitExternal
    },

    onwarn (warning, rollupWarn) {
      if (!['CIRCULAR_DEPENDENCY'].includes(warning.code)) {
        rollupWarn(warning)
      }
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
