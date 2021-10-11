<template>
  <!-- eslint-disable-next-line vue/require-component-is -->
  <component
    v-bind="linkProps"
    :aria-label="ariaLabel"
    class="font-medium rounded-md"
    :class="[
      iconLeft || iconRight ? 'inline-flex items-center px-4 py-2.5' : 'px-4 py-2.5',
      { 'text-md 2xl:text-base ': size === 'lg' },
      { 'text-sm 2xl:text-md ': size === 'md' },
      { 'text-xs 2xl:text-sm ': size === 'sm' }
    ]"
  >
    <div v-if="iconLeft" class="h-full flex items-center justify-center">
      <Component :is="iconLeft" class="mr-2" :class="{ 'w-5 h-5': size === 'lg' }" />
    </div>
    <slot />
    <div v-if="iconRight" class="h-full flex items-center justify-center">
      <Component :is="iconRight" class="ml-2" :class="{ 'w-5 h-5': size === 'lg' }" />
    </div>
  </component>
</template>

<script>
import { defineComponent, computed } from '@nuxtjs/composition-api'
export default defineComponent({
  props: {
    to: {
      type: String,
      default: ''
    },
    href: {
      type: String,
      default: ''
    },
    size: {
      type: String,
      default: 'lg',
      validator (value) {
        return ['sm', 'md', 'lg'].includes(value)
      }
    },
    iconLeft: {
      type: String,
      default: null
    },
    iconRight: {
      type: String,
      default: null
    },
    ariaLabel: {
      type: String,
      default: null
    }
  },
  setup (props) {
    const linkProps = computed(() => {
      const { to, href } = props
      if (to?.length) {
        return {
          is: 'Link',
          to
        }
      } else if (href?.length) {
        return {
          is: 'Link',
          static: true,
          to: '',
          href,
          blank: true
        }
      } else {
        return {
          is: 'button'
        }
      }
    })

    return {
      linkProps
    }
  }
})
</script>
