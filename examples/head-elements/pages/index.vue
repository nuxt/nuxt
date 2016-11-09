<template>
  <nuxt-head>
    <title>I am the title of the page</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </nuxt-head>

  <h1>This page has a title 🤔</h1>
</template>

<script>
export default {
  metaInfo: {
    title: 'This page has a title 🤔',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' }
    ]
  }
}
</script>
