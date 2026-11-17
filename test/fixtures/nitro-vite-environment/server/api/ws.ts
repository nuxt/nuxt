import { defineWebSocketHandler } from 'nitro'

export default defineWebSocketHandler({
  message (peer, message) {
    peer.send(`echo:${message.text()}`)
  },
})
