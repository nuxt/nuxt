import '#polyfill'

import { handle } from '../server'

const functions = require('firebase-functions')

export const server = functions.https.onRequest(handle)
