import { defineHandler, getQuery } from 'nitro/h3'

const apiKeyName = 'apiKey'
const apiKey = 'hehe'

export default defineHandler((event) => {
  return {
    hehe: getQuery(event)[apiKeyName] === apiKey,
  }
})
