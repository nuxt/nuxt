import test from 'ava'
import { resolve } from 'path'
import { Options } from '../index'

test('modulesDir uses /node_modules as default if not set', async t => {
  const options = Options.from({})
  const currentNodeModulesDir = resolve(__dirname, '..', 'node_modules')
  t.true(options.modulesDir.includes(currentNodeModulesDir))
})
