import { writeFile } from 'node:fs/promises'
import { downloadTemplate, startShell } from 'giget'
import { relative } from 'pathe'
import consola from 'consola'
import { defineNuxtCommand } from './index'

const rpath = (p: string) => relative(process.cwd(), p)

const DEFAULT_REGISTRY = 'https://raw.githubusercontent.com/nuxt/starter/templates/templates'

export default defineNuxtCommand({
  meta: {
    name: 'init',
    usage: 'npx nuxi init|create [--template,-t] [--force] [--offline] [--prefer-offline] [--shell] [dir]',
    description: 'Initialize a fresh project'
  },
  async invoke (args) {
    // Clone template
    const template = args.template || args.t || 'v3'

    const t = await downloadTemplate(template, {
      dir: args._[0] as string,
      force: args.force,
      offline: args.offline,
      preferOffline: args['prefer-offline'],
      registry: process.env.NUXI_INIT_REGISTRY || DEFAULT_REGISTRY
    })

    // Show next steps
    const relativeDist = rpath(t.dir)

    // Write .nuxtrc with `shamefully-hoist=true` for pnpm
    const usingPnpm = (process.env.npm_config_user_agent || '').includes('pnpm')
    if (usingPnpm) {
      await writeFile(`${relativeDist}/.npmrc`, 'shamefully-hoist=true')
    }

    const nextSteps = [
      !args.shell && relativeDist.length > 1 && `\`cd ${relativeDist}\``,
      'Install dependencies with `npm install` or `yarn install` or `pnpm install`',
      'Start development server with `npm run dev` or `yarn dev` or `pnpm run dev`'
    ].filter(Boolean)

    consola.log(`✨ Nuxt project is created with \`${t.name}\` template. Next steps:`)
    for (const step of nextSteps) {
      consola.log(` › ${step}`)
    }

    if (args.shell) {
      startShell(t.dir)
    }
  }
})
