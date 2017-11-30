import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Options } from '../index'
import { version } from '../package.json'

test('Nuxt.version is same as package', t => {
  t.is(Nuxt.version, version)
})

test('modulesDir uses /node_modules as default if not set', async t => {
  const options = Options.from({})
  const currentNodeModulesDir = resolve(__dirname, '..', 'node_modules')
  t.true(options.modulesDir.includes(currentNodeModulesDir))
})
