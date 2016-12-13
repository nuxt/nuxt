<template>
  <transition :name="transition.name" :mode="transition.mode">
    <router-view></router-view>
  </transition>
</template>

<script>
export default {
  name: 'nuxt-child',
  props: {
    transition: {
      type: Object,
      default: () => {
        return {
          mode: 'out-in', // out-in ou in-out
          name: 'fade',
          type: '', // animation ou transition
          enter: null, // isFunc = js, is String = css
          enterActive: '',
          beforeEnter: null, // Func
          afterEnter: null,
          enterCancelled: null,
          leave: null, // isFunc = js, is String = css
          leaveActive: '',
          beforeLeave: null, // Func
          afterLeave: null,
          leaveCancelled: null,
          appear: null, // isFunc = js, is String = css
          appearClass: '',
          appearActiveClass: '',
          beforeAppear: null,
          afterAppear: null
        }
      }
    }
  }
}
</script>
