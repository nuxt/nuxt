<script lang="ts">
export default defineNuxtComponent({
  name: 'DefineNuxtComponentTest',
  setup () {
    const router = useRouter()

    return {
      router,
    }
  },
})
</script>

<template>
  <div>
    <div
      data-testid="define-nuxt-component-bar"
      @click="router.push('/define-nuxt-component/nested/bar')"
    >
      Open bar
    </div>
    <div
      data-testid="define-nuxt-component-foo"
      @click="router.push('/define-nuxt-component/nested/foo')"
    >
      Open foo
    </div>
  </div>
</template>
