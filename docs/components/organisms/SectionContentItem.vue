<template>
  <component
    :is="component"
    :to="to"
    :aria-label="title"
    class="flex flex-col items-center transition duration-200 p-6 rounded-md"
    :class="hoverClass"
  >
    <InjectComponent
      :component="image"
      class="mb-4 transition duration-200 text-primary group-hover:text-primary-400"
      :class="imageClass"
    >
      <img loading="lazy" :src="image" :alt="`A ${title} image`">
    </InjectComponent>
    <h3 class="relative inline-flex mb-1 text-center text-body-lg items-center lg:text-body-xl font-bold">
      {{ title }}
      <span v-if="soon" class="absolute -right-48px inline-flex items-center mt-1px px-1.5 py-0.5 rounded text-xs font-medium font-mono bg-cloud-surface dark:bg-sky-dark dark:text-white">soon</span>
    </h3>
    <p class="text-center text-sm lg:text-base mb-4">
      {{ description }}
    </p>
  </component>
</template>

<script>
import { defineComponent, computed } from '@nuxtjs/composition-api'

export default defineComponent({
  props: {
    image: {
      type: String,
      default: ''
    },
    imageClass: {
      type: String,
      default: ''
    },
    soon: {
      type: Boolean,
      default: false
    },
    hoverClass: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    to: {
      type: String,
      default: ''
    },
    linkName: {
      type: String,
      default: ''
    }
  },
  setup (props) {
    const component = computed(() => {
      if (props.to && !props.linkName) {
        return 'Link'
      }
      return 'div'
    })

    return { component }
  }
})
</script>
