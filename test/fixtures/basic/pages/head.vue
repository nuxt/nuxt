<script setup>
const a = ref('')
useHead({
  // title template function example
  titleTemplate: title => `${title} - Title Template Fn Change`,
  bodyAttrs: {
    class: 'body-attrs-test'
  },
  script: [
    {
      src: 'https://a-body-appended-script.com',
      body: true
    }
  ],
  meta: [{ name: 'description', content: 'first' }]
})
useHead({ charset: 'utf-16', meta: [{ name: 'description', content: computed(() => `${a.value} with an inline useHead call`) }] })
useMeta({ script: [{ children: 'console.log("works with useMeta too")' }] })
a.value = 'overriding'
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
      <Meta http-equiv="content-security-policy" content="default-src https" />
    </Head>
  </div>
</template>
