<template>
  <AppPage class="min-h-screen-sm relative z-0 h-full">
    <div class="relative flex flex-col items-center justify-center px-2 sm:px-4 mt-20 lg:mt-32 md:px-0 z-10">
      <h1 class="font-serif text-center text-display-6 md:text-display-5 2xl:text-display-4 mb-6">
        {{ error.message }}
      </h1>
      <NuxtLink
        to="/"
        size="md"
        class="text-gray-800 bg-primary hover:bg-primary-400 focus:bg-primary-400 font-medium rounded-md px-4 py-2.5"
      >
        Go Home
      </NuxtLink>
    </div>
  </AppPage>
</template>

<script>
import { defineComponent } from '@nuxtjs/composition-api'
export default defineComponent({
  props: {
    error: {
      type: Object,
      required: true
    }
  },
  head () {
    return {
      title: this.error.message
    }
  }
})
</script>
