<template>
  <nav ref="nav" class="flex flex-col gap-1 py-4 px-4 sm:px-6">
    <NuxtLink v-for="(link, index) in links" :key="index" :to="link.to" class="font-medium my-1 py-1" :class="{ 'text-primary' : isActive(link) }">
      {{ link.title }}
    </NuxtLink>
  </nav>
</template>

<script>
import { defineComponent, useContext, useRoute, ref, watch, computed } from '@nuxtjs/composition-api'

export default defineComponent({
  props: {
    links: {
      type: Array,
      default: () => []
    }
  },
  setup (props) {
    const { $menu } = useContext()
    const route = useRoute()
    const currentSlug = computed(() => {
      return route.value.path !== '/' && route?.value?.params?.pathMatch
        ? route.value.params.pathMatch.split('/')[0]
        : null
    })
    const nav = ref(null)
    const openedLink = ref(null)

    function selectActiveLink () {
      if (currentSlug.value) {
        for (const [index, link] of props.links.entries()) {
          if (link.slug === currentSlug.value || link.items?.some(item => item.slug === currentSlug.value)) {
            openedLink.value = index
            break
          }
        }
      } else {
        openedLink.value = null
      }
    }

    selectActiveLink()

    watch($menu.visible, (value) => {
      if (value) {
        selectActiveLink()
      }
    })

    function toggle (index) {
      if (openedLink.value === index) {
        openedLink.value = null
      } else {
        openedLink.value = index
      }
    }

    function isActive (link) {
      return `/${currentSlug.value}` === link.to
    }

    return {
      openedLink,
      toggle,
      nav,
      isActive
    }
  }
})
</script>
