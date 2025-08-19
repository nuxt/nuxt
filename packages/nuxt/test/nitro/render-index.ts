// @ts-expect-error untyped
import '#nitro-internal-pollyfills'
import { useNitroApp } from 'nitro/runtime'

const nitroApp = useNitroApp()

async function renderIndex () {
  const text = await nitroApp.fetch('/', {}).then(r => r.text())
  // eslint-disable-next-line no-console
  console.log(text)
}

renderIndex()
