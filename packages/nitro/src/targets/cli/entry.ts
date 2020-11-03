// @ts-ignore
import { render } from '~runtime/server'

const debug = (label, ...args) => console.debug(`> ${label}:`, ...args)

async function main () {
  const url = process.argv[2] || '/'
  debug('URL', url)

  const { html, status, headers } = await render(url)

  debug('Status', status)
  for (const header in headers) {
    debug(header, headers[header])
  }

  console.log('\n', html)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
