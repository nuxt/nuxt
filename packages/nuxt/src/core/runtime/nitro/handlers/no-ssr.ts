import { defineEventHandler, getRequestHeader } from 'h3'
// @todo check for reference in the repo... this doesn't seems to be used
export default defineEventHandler((event) => {
  if (getRequestHeader(event, 'x-nuxt-no-ssr')) {
    event.context.nuxt ||= {}
    event.context.nuxt.noSSR = true
  }
})
