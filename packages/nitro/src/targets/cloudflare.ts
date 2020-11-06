import { extendTarget } from '../utils'
import { SLSTarget } from '../config'
import { worker } from './worker'

export const cloudflare: SLSTarget = extendTarget(worker, {

})
