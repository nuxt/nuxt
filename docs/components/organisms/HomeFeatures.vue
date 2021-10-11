<template>
  <div class="relative">
    <section class="py-40 text-white light:text-secondary-black">
      <NuxtContainer class="flex flex-col items-center">
        <div class="flex flex-col w-full items-center col-span-12">
          <div class="mb-2">
            <span class="text-cloud-dark dark:text-cloud-light font-bold text-lg">{{ category }}</span>
          </div>
          <h2 class="font-normal text-center font-serif text-display-6 md:text-display-5 2xl:text-display-4 mb-2">
            <Markdown use="title" unwrap="p" />
          </h2>
          <p class="font-normal text-center text-body-base md:text-body-lg 2xl:text-body-xl mb-12">
            <Markdown use="description" unwrap="p" />
          </p>
          <div class="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <slot />
          </div>
          <Markdown use="bottom" />
        </div>
      </NuxtContainer>
    </section>
  </div>
</template>

<script>
import { defineComponent } from '@nuxtjs/composition-api'

export default defineComponent({
  props: {
    category: {
      type: String,
      default: 'Category'
    }
  }
})
</script>
