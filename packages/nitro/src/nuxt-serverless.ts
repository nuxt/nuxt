
require('../dist').runCLI().catch((error) => {
  const consola = require('consola')
  consola.error(error)
  process.exit(1)
})
