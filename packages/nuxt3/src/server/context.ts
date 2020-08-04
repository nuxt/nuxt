import { Server } from 'src/server'

export default class ServerContext {
  nuxt: Server['nuxt']
  globals: Server['globals']
  options: Server['options']
  resources: Server['resources']

  constructor (server: Server) {
    this.nuxt = server.nuxt
    this.globals = server.globals
    this.options = server.options
    this.resources = server.resources
  }
}
