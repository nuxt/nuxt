import { defineEventHandler, handleCors } from 'h3'

export default defineEventHandler((event) => {
  if (event.path.startsWith('/api/item') && handleCors(event, { origin: ['https://app.example'], methods: ['GET', 'POST'] })) {
    return
  }
})
