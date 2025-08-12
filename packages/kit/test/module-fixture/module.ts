import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineNuxtModule } from 'nuxt/kit'
import { withoutTrailingSlash } from 'ufo'
import { normalize } from 'pathe'

const hooksLogFile = withoutTrailingSlash(normalize(fileURLToPath(new URL('./hooks-logs', import.meta.url))))

export default defineNuxtModule({
  meta: {
    name: 'test-module',
    version: '1.0.0',
  },

  onInstall () {
    appendFileSync(hooksLogFile, 'install\n')
  },

  onUpgrade () {
    appendFileSync(hooksLogFile, 'upgrade\n')
  },
})
