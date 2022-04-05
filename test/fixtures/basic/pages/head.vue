<script setup>
useHead({
  bodyAttrs: {
    class: 'body-attrs-test'
  },
  meta: [{ name: 'description', content: 'first' }]
})
useHead({ meta: [{ name: 'description', content: 'overriding with an inline useHead call' }] })
useMeta({ script: [{ children: 'console.log("works with useMeta too")' }] })
</script>

<script>
export default {
  head () {
    return {
      htmlAttrs: {
        class: 'html-attrs-test'
      }
    }
  }
}
</script>

<template>
  <div>
    <Head>
      <Title>Using a dynamic component</Title>
    </Head>
  </div>
</template>
