<template>
  <NuxtExampleLayout example="use-meta" show-tips>
    <div
      class="bg-gray-400/10 border-2 border-dashed border-gray-400/50 rounded-xl py-8 px-2 op-80"
    >
      There are renderless <code>&lt;Html&gt;</code>, <code>&lt;Meta&gt;</code>, <code>&lt;Title&gt;</code> components
      <br>that can magically bind the meta using Vue template.
    </div>

    <Html :lang="String(dynamic)">
      <Head>
        <Title>Luck number: {{ dynamic }}</Title>
        <Meta name="description" :content="`My page's ${dynamic} description`" />
        <Link rel="preload" href="/test.txt" as="script" />
      </Head>
    </Html>

    <div class="mt-5">
      <NButton @click="dynamic = Math.round(Math.random() * 100)">
        Click me and see the dynamic title
      </NButton>
    </div>

    <template #tips>
      <div class="flex-auto">
        <p>
          This example shows how to use <code>useMeta</code> and Nuxt built-in components to bind meta data to the <code>head</code> of the page.
        </p>
        <p>
          Learn more about
          <NuxtLink to="https://v3.nuxtjs.org/docs/usage/meta-tags" target="_blank">
            Meta tags
          </NuxtLink>.
          Open in editor to see the source code 👉
        </p>
      </div>
    </template>
  </NuxtExampleLayout>
</template>

<script>
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
