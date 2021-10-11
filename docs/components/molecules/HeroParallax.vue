<template>
  <div ref="containerImg" class="absolute top-0 left-0 z-10 w-full h-full select-none pointer-events-none transition-opacity ease-out duration-800" :class="[hidden ? 'opacity-0' : 'opacity-100']">
    <img
      ref="gem3"
      data-speed="1"
      loading="lazy"
      :src="`/img/home/hero/gem-3.svg`"
      class="hidden lg:block absolute left-1/2 -ml-16 top-20"
      alt="An image of a green gem from nuxt galaxy"
    >
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, onBeforeUnmount } from '@nuxtjs/composition-api'

export default defineComponent({
  setup () {
    const containerImg = ref(null)
    const hidden = ref(true)

    function parallax (e) {
      const images = Array.from(containerImg.value.children)
      if (hidden.value) {
        hidden.value = false
      }

      for (const el of images) {
        const image = el
        const speed = parseInt(image.getAttribute('data-speed'))
        const x = (window.innerWidth - e.pageX * speed) / 100
        const y = (window.innerHeight - e.pageY * speed) / 100
        image.style.transform = `translateX(${x}px) translateY(${y}px)`
      }
    }

    if (process.client) {
      const isTouchDevice = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0))
      if (isTouchDevice) {
        onMounted(() => {
          setTimeout(() => {
            hidden.value = false
          }, 200)
        })
      } else {
        onMounted(() => window.addEventListener('mousemove', parallax))
        onBeforeUnmount(() => window.removeEventListener('mousemove', parallax))
      }
    }

    return {
      hidden,
      containerImg,
      parallax
    }
  }
})
</script>
