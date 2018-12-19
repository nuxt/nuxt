#!/usr/local/bin/node -r esm

import consola from 'consola'
import { NuxtCommand } from '@nuxt/cli'

NuxtCommand.run({
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
    consola.info(cmd.argv)
  }
})
