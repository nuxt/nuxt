import { defineNuxtConfig } from '@nuxt/kit'

export default defineNuxtConfig({
  vite: process.env.NODE_ENV === 'development',
  modules: [
    '~/modules/windicss',
    '~/modules/content'
  ]
})
