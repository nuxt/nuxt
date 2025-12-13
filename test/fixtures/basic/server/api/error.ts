import { HTTPError, defineHandler } from 'nitro/h3'

export default defineHandler(() => {
  throw new HTTPError({ status: 400 })
})
