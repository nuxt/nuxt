import { cyan } from 'colorette'
import { commands, defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'help',
    usage: 'nuxt help',
    description: 'Show help'
  },
  invoke (_args) {
    const sections: string[] = []

    sections.push(`Usage: ${cyan(`npx nuxi ${Object.keys(commands).join('|')} [args]`)}`)

    console.log(sections.join('\n\n') + '\n')
  }
})
