import { defineHandler } from 'nitro/h3'

import { queryPing } from '../../modules/runtime/query'

// a plain user route: nothing here is wrapped by the compat layer
export default defineHandler(event => queryPing(event))
