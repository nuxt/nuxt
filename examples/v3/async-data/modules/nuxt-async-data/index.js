import { join } from 'path'

/*
** Module to keep retro-compatibility with Nuxt 1 & 2
*/
export default function () {
  // Add plugin (that add asyncData middleware)
  this.addPlugin(join(__dirname, './plugins/async-data.js'))

  // Add asyncData middleware
  this.options.router.middleware.push('asyncData')
}
