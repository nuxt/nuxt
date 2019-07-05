#!/usr/bin/env node

const boxen = require('boxen')
const chalk = require('chalk').default

const warningBox = boxen([
  chalk.yellow.bold('IMPORTANT : Package deprecation'),
  '',
  `Nuxt TypeScript Support has been refactored to be used with ${chalk.green.bold('nuxt')} package.`,
  `Which means that ${chalk.yellow.bold(`nuxt-ts`)} package is now no longer needed and is now tagged as ${chalk.yellow.bold('deprecated')}.`,
  `${chalk.bold.underline('We highly recommend')} to follow the guidelines below :`,
  '',
  chalk.yellow.bold('Migration guide (2.5.x)'),
  '',
  chalk.bold('Using yarn'),
  'yarn remove nuxt-ts',
  'yarn add nuxt',
  'yarn add -D @nuxt/typescript',
  '',
  chalk.bold('Using npm'),
  'npm uninstall nuxt-ts',
  'npm install nuxt',
  'npm install -D @nuxt/typescript',
  '',
  ` ----- ${chalk.bold('nuxt.config.ts')} -----`,
  '| build: {                 |',
  `| ${chalk.red('-- useForkTsChecker: ...')} |`,
  `| ${chalk.green('++ typescript : {')}        |`,
  `| ${chalk.green('++   typeCheck: ...')}      |`,
  `| ${chalk.green('++ }')}                     |`,
  '| }                        |',
  ' --------------------------',
  '',
  'Find more information in updated docs : ' + chalk.blue.underline('https://nuxtjs.org/guide/typescript')
].join('\n'), Object.assign({
  borderColor: 'yellow',
  borderStyle: 'round',
  padding: 1,
  margin: 1
})) + '\n'

process.stdout.write(warningBox)

const suffix = require('../package.json').name.includes('-edge') ? '-edge' : ''
require('@nuxt/cli' + suffix).run()
  .catch((error) => {
    require('consola').fatal(error)
    process.exit(2)
  })
