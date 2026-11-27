import { defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
  event.context.inProcess = event.node.req.socket.readyState === 'readOnly'
})
