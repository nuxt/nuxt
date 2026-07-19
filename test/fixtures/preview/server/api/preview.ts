import { defineEventHandler, getQuery } from 'h3'

const apiKeyName = 'apiKey'
const apiKey = 'hehe'

export default defineEventHandler((event) => {
  return {
    hehe: getQuery(event)[apiKeyName] === apiKey,
  }
})
