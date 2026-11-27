<script setup lang="ts">
const config = useRuntimeConfig()

const path = useNuxtApp().ssrContext!.url
if (path.startsWith('/throws')) {
  throw createError({ status: 503, statusText: 'Service Unavailable', message: 'the render threw', fatal: true })
}
if (path.startsWith('/rich-data')) {
  throw createError({ status: 418, statusText: 'I am a teapot', message: 'rich data', data: { keep: 'yes', drop: () => {} }, fatal: true })
}
if (path.startsWith('/unhandled')) {
  throw new Error('an unhandled failure')
}
if (path.startsWith('/prefetch-links')) {
  useNuxtApp().hook('app:rendered', ({ ssrContext }) => {
    ssrContext!.payload.prefetchLinks = [{ rel: 'preload', as: 'script', href: '/next-page.js' }]
  })
}
if (path.startsWith('/response-header')) {
  const header = useResponseHeader('x-written')
  const before = String(header.value)
  header.value = 'written'
  useResponseHeader('x-read-back').value = `${before} -> ${header.value}`
}
if (path.startsWith('/invalid-cookie')) {
  useCookie('invalid name').value = 'value'
}
if (path.startsWith('/streamed-cookie')) {
  useCookie('streamed').value = 'set-before-headers'
}
if (path.startsWith('/late-cookie')) {
  useNuxtApp().hook('app:rendered', () => {
    lateCookie.value = 'set-after-headers'
  })
  const lateCookie = useCookie('late')
}
if (path.startsWith('/redirected-cookie')) {
  useCookie('redirected').value = 'set-before-redirect'
  await navigateTo('/')
}
if (path.startsWith('/failed-cookie')) {
  useCookie('failed').value = 'set-before-error'
  showError({ status: 401, statusText: 'Unauthorized' })
}
if (path.startsWith('/failing-fetch')) {
  const { error } = await useFetch('/api/standalone')
  useResponseHeader('x-fetch-error').value = String(error.value?.status)
}
if (path.startsWith('/thrown-status')) {
  const { error } = await useAsyncData('thrown-status', () => Promise.reject(Object.assign(new Error('gone'), { statusCode: 410 })))
  useResponseHeader('x-async-data-error').value = String(error.value?.status)
}
if (path.startsWith('/rewritten')) {
  useNuxtApp().hook('app:rendered', ({ renderResult }) => {
    renderResult!.html = renderResult!.html.replace('rendered without nitro', 'rewritten after render')
  })
}

useHead({
  title: 'Standalone renderer',
})

if (path.startsWith('/head-override')) {
  useHead({
    htmlAttrs: { lang: 'fr', class: 'page' },
    templateParams: { siteName: 'Page site' },
    meta: [
      { name: 'description', content: 'page description' },
      { key: 'theme', name: 'theme-color', content: '#000' },
    ],
  })
}
if (path.includes('normalize-hook')) {
  useNuxtApp().ssrContext!.head.hooks.hook('entries:normalize', () => {})
}
if (path.includes('rewrite-lang-hook')) {
  useNuxtApp().ssrContext!.head.hooks.hook('entries:normalize', ({ tags }) => {
    for (const tag of tags) {
      if (tag.tag === 'htmlAttrs' && tag.props.lang === 'en') {
        tag.props.lang = 'en-GB'
      }
    }
  })
}

const { data } = await useAsyncData('greeting', () => Promise.resolve('rendered without nitro'))

const DeferredPanel = defineAsyncComponent(() => import('./components/DeferredPanel.vue'))
</script>

<template>
  <div>
    <h1>{{ data }}</h1>
    <p id="greeting">
      {{ config.public.greeting }}
    </p>
    <DeferredPanel v-if="path.startsWith('/deferred-panel')" />
  </div>
</template>
