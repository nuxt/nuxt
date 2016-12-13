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
          hooks: false,
          mode: 'out-in', // out-in ou in-out
          name: 'fade',
          type: '', // animation ou transition
          enterClass: '',
          enterActiveClass: '',
          leaveClass: '',
          leaveActiveClass: '',
          beforeEnter: null, // Func
          enter: null,
          afterEnter: null,
          enterCancelled: null,
          beforeLeave: null,
          leave: null,
          afterLeave: null,
          leaveCancelled: null
        }
      }
    }
  }
}
</script>
