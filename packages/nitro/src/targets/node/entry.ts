// @ts-ignore
import { render } from '~runtime/server'
// @ts-ignore
export { render } from '~runtime/server'

async function cli () {
  const url = process.argv[2] || '/'

  const debug = (label, ...args) => console.debug(`> ${label}:`, ...args)

  const { html, status, headers } = await render(url)

  debug('URL', url)
  debug('Status', status)
  for (const header in headers) {
    debug(header, headers[header])
  }

  console.log('\n', html)
}

if (require.main === module) {
  cli().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
