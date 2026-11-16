import { defineEventHandler } from 'nitro/h3'
import { recordDevClientCss } from '../utils/renderer/dev-client-css'

const handler: ReturnType<typeof defineEventHandler> = defineEventHandler(event => recordDevClientCss(event))

export default handler
