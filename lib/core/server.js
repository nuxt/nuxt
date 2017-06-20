import http from 'http'
import chalk from 'chalk'

class Server {
  constructor (nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options

    // Initialize
    /* istanbul ignore if */
    if (nuxt.initialized) {
      // If nuxt already initialized
      this._ready = this.ready().catch(this.nuxt.errorHandler)
    } else {
      // Wait for hook
      this.nuxt.plugin('afterInit', () => {
        this._ready = this.ready()
        return this._ready
      })
    }

    // Stop server on nuxt.close()
    this.nuxt.plugin('close', () => this.close())
  }

  async ready () {
    /* istanbul ignore if */
    if (this._ready) {
      return this._ready
    }

    this.server = http.createServer(this.nuxt.render)

    return this
  }

  listen (port, host) {
    host = host || 'localhost'
    port = port || 3000
    return this.ready()
      .then(() => {
        this.server.listen(port, host, () => {
          let _host = host === '0.0.0.0' ? 'localhost' : host
          // eslint-disable-next-line no-console
          console.log('\n' + chalk.bold(chalk.bgBlue.black(' OPEN ') + chalk.blue(` http://${_host}:${port}\n`)))
        })
      }).catch(this.nuxt.errorHandler)
  }

  close () {
    return new Promise((resolve, reject) => {
      this.server.close(err => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }
}

export default Server
