import { HTTPError, defineEventHandler } from 'nitro/h3'

export default defineEventHandler(() => {
  throw new HTTPError({ status: 400 })
})
