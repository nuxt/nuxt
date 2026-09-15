import { mkdir, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'

import { dirname, join } from 'pathe'
import { configDiagnostics } from '@nuxt/kit/internal'
import type { NuxtOptions } from '@nuxt/schema'

const MIN_LENGTH = 32
const GENERATED_BYTES = 32
const APP_SECRET_FILE = 'app-secret'

const GENERATED_RE = /^[0-9a-f]{64}$/

function generateSecret () {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(GENERATED_BYTES))
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function resolveDevAppSecret (options: NuxtOptions, env = process.env): Promise<void> {
  const configured = env.NITRO_APP_SECRET ?? env.NUXT_APP_SECRET ?? options.runtimeConfig.appSecret

  if (typeof configured === 'string' && configured.length >= MIN_LENGTH) {
    return
  }

  if (!options.test) {
    configDiagnostics.NUXT_B5028({ minLength: MIN_LENGTH })
  }

  const secretFile = join(options.buildDir, APP_SECRET_FILE)
  let secret = await readFile(secretFile, 'utf8').then(contents => contents.trim()).catch(() => '')

  if (!GENERATED_RE.test(secret)) {
    secret = generateSecret()
    await mkdir(dirname(secretFile), { recursive: true })
    await writeFile(secretFile, secret, 'utf8')
  }

  options.runtimeConfig.appSecret = secret

  // nitro reapplies the environment over the resolved config at runtime
  if (env.NUXT_APP_SECRET !== undefined) {
    env.NUXT_APP_SECRET = secret
  }
  if (env.NITRO_APP_SECRET !== undefined) {
    env.NITRO_APP_SECRET = secret
  }
}
