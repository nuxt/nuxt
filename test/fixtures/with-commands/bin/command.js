#!/usr/local/bin/node -r esm

import consola from 'consola'
import { NuxtCommand, run } from '@nuxt/cli'

const cmd = NuxtCommand.from({
  name: 'command',
  description: 'My Custom Command',
  usage: 'command <foobar>',
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
      process.exit(0)
    } catch (err) {
      consola.fatal(err)
    }
  }
})

run(cmd)
