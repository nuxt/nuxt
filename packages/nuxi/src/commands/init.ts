import { existsSync, readdirSync } from 'fs'
import createTiged from 'tiged'
import { relative, resolve } from 'pathe'
import superb from 'superb'
import consola from 'consola'
import { defineNuxtCommand } from './index'

const rpath = p => relative(process.cwd(), p)

const knownTemplates = {
  nuxt3: 'nuxt/starter#v3',
  v3: 'nuxt/starter#v3',
  bridge: 'nuxt/starter#bridge'
}

const resolveTemplate = (template) => {
  if (!template) {
    return knownTemplates.nuxt3
  }

  if (typeof template === 'boolean') {
    consola.error('Please specify a template')
    process.exit(1)
  }

  if (template in knownTemplates) {
    return knownTemplates[template]
  }

  if (template.includes('/')) {
    return template
  }

  consola.error(`Invalid template name: \`${template}\``)
  process.exit(1)
}

export default defineNuxtCommand({
  meta: {
    name: 'init',
    usage: 'npx nuxi init [--verbose|-v] [--template,-t] <dir>',
    description: 'Initialize a fresh project'
  },
  async invoke (args) {
    // Clone template
    const src = resolveTemplate(args.template || args.t)
    const dstDir = resolve(process.cwd(), args._[0] || 'nuxt-app')
    const tiged = createTiged(src, { cache: false /* TODO: buggy */, verbose: (args.verbose || args.v) })
    if (existsSync(dstDir) && readdirSync(dstDir).length) {
      consola.error(`Directory ${dstDir} is not empty. Please pick another name or remove it first. Aborting.`)
      process.exit(1)
    }
    const formatArgs = msg => msg.replace('options.', '--')
    tiged.on('warn', event => consola.warn(formatArgs(event.message)))
    tiged.on('info', event => consola.info(formatArgs(event.message)))
    try {
      await tiged.clone(dstDir)
    } catch (e) {
      if (e.toString().includes('could not find commit hash')) {
        consola.warn('Make sure you have installed `git` correctly')
        process.exit(1)
      }
      throw e
    }

    // Show neet steps
    console.log(`\n 🎉  Another ${superb.random()} Nuxt project just made! Next steps:` + [
      '',
      `📁  \`cd ${rpath(dstDir)}\``,
      '💿  Install dependencies with `npm install` or `yarn install`',
      '🚀  Start development server with `npm run dev` or `yarn dev`',
      ''
    ].join('\n\n     '))
  }
})
