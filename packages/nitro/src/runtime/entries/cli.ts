import '~polyfill'
import { localCall } from '../server'

async function cli () {
  const url = process.argv[2] || '/'
  const debug = (label, ...args) => console.debug(`> ${label}:`, ...args)
  const r = await localCall({ url })

  debug('URL', url)
  debug('StatusCode', r.status)
  debug('StatusMessage', r.statusText)
  // @ts-ignore
  for (const header of r.headers.entries()) {
    debug(header[0], header[1])
  }
  console.log('\n', r.body.toString())
}

if (require.main === module) {
  cli().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
