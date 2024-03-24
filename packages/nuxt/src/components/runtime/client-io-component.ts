import { defineComponent, onMounted, onUnmounted, ref } from 'vue'

export default defineComponent({
  setup (props, { emit }) {
    const intersectionTarget = ref(null)
    let observer = null

    const intersectionCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          emit('intersect')
          observer.unobserve(entry.target)
        }
      })
    }

    onMounted(() => {
      observer = new IntersectionObserver(intersectionCallback)
      observer.observe(intersectionTarget.value)
    })

    onUnmounted(() => {
      if (observer) {
        observer.disconnect()
      }
    })

    return {
      intersectionTarget
    }
  }
})
