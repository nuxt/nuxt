<script lang="ts" setup>
const description = ref('head script setup description for %site.name')
const siteName = ref()
// server meta
useServerSeoMeta({
  description,
  ogDescription: description,
  ogImage: '%site.url/og-image.png',
  ogTitle: '%s %separator %site.name',
  ogType: 'website',
  ogUrl: '%site.url/head-script-setup'
})

useServerHead({
  style: [
    '/* Custom styles */',
    'h1 { color: salmon; }'
  ]
})

useHead({
  title: 'head script setup',
  titleTemplate: '%s %separator %site.name',
  templateParams: {
    separator: () => '-',
    site: {
      url: 'https://example.com',
      name: siteName
    }
  }
})

useHeadSafe({
  script: [
    {
      id: 'xss-script',
      // @ts-expect-error not allowed
      innerHTML: 'alert("xss")'
    }
  ],
  meta: [
    {
      // @ts-expect-error not allowed
      'http-equiv': 'refresh',
      content: '0;javascript:alert(1)'
    }
  ]
})

siteName.value = 'Nuxt Playground'
</script>

<template>
  <div>
    <h1>head script setup</h1>
  </div>
</template>
