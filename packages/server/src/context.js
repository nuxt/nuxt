export default class ServerContext {
  constructor (server) {
    this.nuxt = server.nuxt
    this.globals = server.globals
    this.options = server.options
    this.resources = server.resources
  }
}
