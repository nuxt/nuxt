// @ts-expect-error untyped
import '#nitro-internal-pollyfills'
import { useNitroApp } from 'nitro/app'

const nitroApp = useNitroApp()

async function renderIndex () {
  const res = await nitroApp.fetch(new Request('/'))
  // eslint-disable-next-line no-console
  console.log(await res.text())
}

renderIndex()
