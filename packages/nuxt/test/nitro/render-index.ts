// @ts-expect-error untyped
import '#nitro-internal-pollyfills'
import type { NitroApp } from 'nitro/types'
// @ts-expect-error untyped
import { useNitroApp } from 'nitropack/runtime'

const nitroApp = useNitroApp()

async function renderIndex () {
  const text = await (nitroApp as NitroApp).localFetch('/', {}).then(r => r.text())
  // eslint-disable-next-line
  console.log(text)
}

renderIndex()
