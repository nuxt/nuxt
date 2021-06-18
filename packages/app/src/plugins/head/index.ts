import { createHead, renderHeadToString } from '@vueuse/head'
import { defineNuxtPlugin } from '@nuxt/app'
import { Head, Html, Body, Title, Meta, Link, Script, Style } from './head'

export default defineNuxtPlugin((nuxt) => {
  const { app, ssrContext } = nuxt
  const head = createHead()

  app.use(head)

  app.component('NuxtHead', Head)
  app.component('NuxtHtml', Html)
  app.component('NuxtBody', Body)
  app.component('NuxtTitle', Title)
  app.component('NuxtMeta', Meta)
  app.component('NuxtHeadLink', Link)
  app.component('NuxtScript', Script)
  app.component('NuxtStyle', Style)

  if (process.server) {
    ssrContext.head = () => renderHeadToString(head)
  }
})
