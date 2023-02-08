import { existsSync, promises as fsp } from 'node:fs'
import { dirname, relative } from 'node:path'
import { execa } from 'execa'
import { setupDotenv } from 'c12'
import { resolve } from 'pathe'
import consola from 'consola'
import { loadKit } from '../utils/kit'

import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'preview',
    usage: 'npx nuxi preview|start [--dotenv] [rootDir]',
    description: 'Launches nitro server for local testing after `nuxi build`.'
  },
  async invoke (args) {
    process.env.NODE_ENV = process.env.NODE_ENV || 'production'
    const rootDir = resolve(args._[0] || '.')
    const { loadNuxtConfig } = await loadKit(rootDir)
    const config = await loadNuxtConfig({ cwd: rootDir })
    const serverOutputDir = config.nitro.output?.dir?.replace(/^~\//, '') || '.output'

    const nitroJSONPaths = [`${serverOutputDir}/nitro.json`, 'nitro.json'].map(p => resolve(rootDir, p))
    const nitroJSONPath = nitroJSONPaths.find(p => existsSync(p))
    if (!nitroJSONPath) {
      consola.error('Cannot find `nitro.json`. Did you run `nuxi build` first? Search path:\n', nitroJSONPaths)
      process.exit(1)
    }
    const outputPath = dirname(nitroJSONPath)
    const nitroJSON = JSON.parse(await fsp.readFile(nitroJSONPath, 'utf-8'))

    consola.info('Node.js version:', process.versions.node)
    consola.info('Preset:', nitroJSON.preset)
    consola.info('Working dir:', relative(process.cwd(), outputPath))

    if (!nitroJSON.commands.preview) {
      consola.error('Preview is not supported for this build.')
      process.exit(1)
    }

    const envExists = args.dotenv ? existsSync(resolve(rootDir, args.dotenv)) : existsSync(rootDir)
    if (envExists) {
      consola.info('Loading `.env`. This will not be loaded when running the server in production.')
      await setupDotenv({ cwd: rootDir, fileName: args.dotenv })
    }

    consola.info('Starting preview command:', nitroJSON.commands.preview)
    const [command, ...commandArgs] = nitroJSON.commands.preview.split(' ')
    consola.log('')
    await execa(command, commandArgs, { stdio: 'inherit', cwd: outputPath })
  }
})
