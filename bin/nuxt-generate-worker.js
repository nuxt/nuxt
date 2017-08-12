
const isMaster = require('cluster').isMaster
if (isMaster) {
  console.error(`nuxt-generate-worker should not be called directly`) // eslint-disable-line no-console
  process.exit(1)
}

const { Nuxt, Generator } = require('../')
const debug = require('debug')('nuxt:generate-worker')

const options = JSON.parse(process.env.options)

const nuxt = new Nuxt(options)
const generator = new Generator(nuxt)

generator.initiate({ build: false, init: false })
  .then(() => {
    debug(`Worker ${process.pid} requesting routes from master process`)
    process.send({ cmd: 'requestRoutes' })
  })

process.on('message', function (msg) {
  if (msg.cmd) {
    if (msg.cmd === 'requestRoutes') {
      debug(`Worker ${process.pid} received ${msg.routes.length} routes from master`)

      let errors = []
      new Promise(async (resolve) => {
        errors = await generator.generateRoutes(msg.routes)
        resolve()
      })
        .then(() => {
          if (errors.length) {
            errors = errors.map((error) => {
              if (error.type === 'unhandled') {
                // convert error stack to a string already, we cant send a stack object to the master process
                error.error = { stack: '' + error.error.stack }
              }
              return error
            })
            process.send({ cmd: 'errors', errors: errors })
          }

          process.send({ cmd: 'requestRoutes' })
        })
        .catch((err) => {
          console.error(`Worker ${process.pid}: Could not generate routes`) // eslint-disable-line no-console
          console.error(err) // eslint-disable-line no-console
          process.exit(1)
        })
    }
  }
})
