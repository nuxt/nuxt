import { downloadRepo, startShell } from 'giget'
import { relative, resolve } from 'pathe'
import superb from 'superb'
import consola from 'consola'
import { defineNuxtCommand } from './index'

const rpath = (p: string) => relative(process.cwd(), p)

const resolveTemplate = (template: string | boolean) => {
  if (typeof template === 'boolean') {
    consola.error('Please specify a template!')
    process.exit(1)
  }

  if (!template) {
    template = 'v3'
  }

  if (template.includes('/')) {
    return template
  }

  return `nuxt/starter#${template}`
}

export default defineNuxtCommand({
  meta: {
    name: 'init',
    usage: 'npx nuxi init|create [--template,-t] [--force] [--offline] [--prefer-offline] [--shell] [dir]',
    description: 'Initialize a fresh project'
  },
  async invoke (args) {
    // Clone template
    const src = resolveTemplate(args.template || args.t)
    const dstDir = resolve(process.cwd(), args._[0] || 'nuxt-app')
    if (args.verbose || args.v) {
      process.env.DEBUG = process.env.DEBUG || 'true'
    }
    await downloadRepo(src, dstDir, {
      force: args.force,
      offline: args.offline,
      preferOffline: args['prefer-offline']
    })

    // Show next steps
    const relativeDist = rpath(dstDir)
    const nextSteps = [
      relativeDist.length > 1 && `📁  \`cd ${relativeDist}\``,
      '💿  Install dependencies with `npm install` or `yarn install` or `pnpm install --shamefully-hoist`',
      '🚀  Start development server with `npm run dev` or `yarn dev` or `pnpm run dev`'
    ].filter(Boolean)

    consola.log(`\n ✨ Your ${superb.random()} Nuxt project is just created! Next steps:\n`)
    for (const step of nextSteps) {
      consola.log(` ${step}\n`)
    }

    if (args.shell) {
      startShell(dstDir)
    }
  }
})
