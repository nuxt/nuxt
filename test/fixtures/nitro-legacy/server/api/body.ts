import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const { name } = await readBody(event)
  return { name }
})
