<template>
  <aside class="fixed z-50 lg:z-0 lg:static">
    <div class="h-full overflow-auto pointer-events-none lg:overflow-visible">
      <!-- scrim -->
      <Transition name="fade">
        <div
          v-if="$menu.visible.value"
          class="fixed top-0 left-0 z-0 w-full h-full pointer-events-auto d-bg-header d-blur-header lg:hidden"
          @click.stop="$menu.toggle"
        />
      </Transition>

      <!-- Desktop aside -->
      <div
        class="
          hidden
          lg:block
          fixed
          top-0
          left-0
          overflow-auto
          pointer-events-auto
          min-h-fill-available
          h-screen
          sticky
          top-header
          w-60
        "
      >
        <div class="w-auto h-full overflow-auto">
          <AsideNavigation />
        </div>
      </div>

      <!-- Mobile aside -->
      <Transition name="slide-from-left-to-left">
        <div
          v-show="$menu.visible.value"
          class="
            lg:hidden
            fixed
            top-0
            left-0
            w-auto
            h-full
            overflow-auto
            pointer-events-auto
            min-h-fill-available
            border-r
            dark:border-sky-darker
            !w-base
          "
        >
          <div class="w-auto h-full overflow-auto d-bg-header">
            <div
              class="flex items-center justify-between w-full px-0.5 sm:px-2 h-header d-aside-header-bg"
            >
              <button
                class="transition-colors duration-200 d-secondary-text hover:d-secondary-text-hover focus:outline-none"
                aria-label="backButton"
                @click.stop="mobileBack"
              >
                <IconArrowLeft v-if="!mobileMainNav && layout.aside" class="p-3 w-12 h-12" />
                <IconClose v-else class="p-3 w-12 h-12" />
              </button>
              <div class="flex items-center h-header space-x-1">
                <GitHubButton />
                <TwitterButton />
                <ColorSwitcher padding="p-3" />
              </div>
            </div>

            <AsideNavigation v-if="!mobileMainNav && layout.aside" />
            <AsideHeaderNavigation v-else :links="links" />
          </div>
        </div>
      </Transition>
    </div>
  </aside>
</template>

<script lang="ts">
import { defineComponent, useContext, ref, watch } from '@nuxtjs/composition-api'

export default defineComponent({
  props: {
    links: {
      type: Array,
      default: () => []
    }
  },
  setup () {
    const { $docus, $menu } = useContext()

    const mobileMainNav = ref(!$docus.layout.value.aside)

    watch($menu.visible, (value, old) => {
      if (value && !old && $docus.layout.value.aside) {
        mobileMainNav.value = false
      }
    })

    function mobileBack () {
      if (!mobileMainNav.value) {
        mobileMainNav.value = true
      } else {
        $menu.close()
      }
    }

    return {
      mobileMainNav,
      mobileBack,
      layout: $docus.layout
    }
  }
})
</script>
