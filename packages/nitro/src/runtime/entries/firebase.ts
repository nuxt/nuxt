import '#polyfill'

// @ts-ignore
import functions from 'firebase-functions'
import { handle } from '../server'

export const server = functions.https.onRequest(handle)
