// @ts-expect-error untyped
import '#nitro-internal-pollyfills'
import { useNitroApp } from 'nitro/app'

const nitroApp = useNitroApp()

async function renderIndex () {
  const res = await nitroApp.fetch(new Request('/'))
  if (!res.ok) {
    throw new Error(`Failed to render /: ${res.status} ${res.statusText}`)
  }
  // eslint-disable-next-line no-console
  console.log(await res.text())
}

renderIndex()
