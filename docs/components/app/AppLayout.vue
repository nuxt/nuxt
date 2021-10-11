<template>
  <div class="relative w-full">
    <AppHeader :links="headerLinks" />

    <div class="lg:flex" :class="{ 'd-container': layout.aside }">
      <slot v-if="['xs', 'sm', 'md'].includes($mq) || layout.aside" name="aside">
        <AppAside :links="headerLinks" :class="layout.asideClass" />
      </slot>

      <div class="flex-auto w-full min-w-0 lg:static lg:max-h-full lg:overflow-visible">
        <slot />
      </div>
    </div>
    <AppFooter />
  </div>
</template>

<script>
import { defineComponent } from '@nuxtjs/composition-api'

export default defineComponent({
  data () {
    return {
      headerLinks: []
    }
  },
  async fetch () {
    const { $docus } = this
    this.headerLinks = (await $docus
      .search('/collections/header')
      .fetch()).links
  },
  computed: {
    layout () {
      return this.$docus.layout.value
    }
  }
})
</script>
