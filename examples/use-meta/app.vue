<template>
  <div>
    Hello World

    <Head :lang="'' + dynamic">
      <Title>{{ dynamic }} title</Title>
      <Meta name="description" :content="`My page's ${dynamic} description`" />
      <Link rel="preload" href="/test.txt" as="script" />
    </Head>

    <button class="blue" @click="dynamic = Math.random() * 100">
      Clickme
    </button>
  </div>
</template>

<script lang="ts">

export default {
  setup () {
    useMeta({
      bodyAttrs: {
        class: 'test'
      }
    })
    return { dynamic: ref(49) }
  },
  head: {
    title: 'Another title'
  }
}
</script>
