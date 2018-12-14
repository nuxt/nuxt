#!/bin/env node -r esm

import consola from 'consola'
import { NuxtCommand, run } from '@nuxt/cli'

const cmd = NuxtCommand.from({
  name: 'my-custom-command',
  description: 'My Custom Command',
  usage: 'my-custom-command <foobar>',
  options: {
    foobar: {
      alias: 'fb',
      type: 'string',
      description: 'Simple test string'
    }
  },
  run(cmd) {
    try {
      const argv = cmd.getArgv()
      consola.info(argv._[0])
      process.exit(0)
    } catch (err) {
      consola.fatal(err)
    }
  }
})

run(cmd)
