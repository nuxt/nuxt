import { defineHandler } from 'nitro/h3'

// @ts-expect-error alias registered by the module
import { handleAuth } from '#legacy-auth'

export default defineHandler(event => handleAuth(event))
