// @ts-expect-error untyped
import '#nitro-internal-pollyfills'
import type { NitroApp } from '#internal/nitro/app'
import { useNitroApp } from '#internal/nitro/app'

const nitroApp = useNitroApp()

async function renderIndex () {
  const text = await (nitroApp as NitroApp).localFetch('/', {}).then(r => r.text())
  // eslint-disable-next-line no-console
  console.log(text)
}

renderIndex()
