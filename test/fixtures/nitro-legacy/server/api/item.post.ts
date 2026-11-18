import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async event => ({ received: await readBody(event) }))
