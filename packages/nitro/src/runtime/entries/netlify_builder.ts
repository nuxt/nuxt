// @ts-ignore
import { builderFunction } from '@netlify/functions'
// @ts-ignore
import { handler as _handler } from '~runtime/entries/lambda'

export const handler = builderFunction(_handler)
