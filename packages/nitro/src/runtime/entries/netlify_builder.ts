import { builder } from '@netlify/functions'
// @ts-ignore
import { handler as _handler } from '#nitro/entries/lambda'

export const handler = builder(_handler)
