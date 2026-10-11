<script setup lang="ts" vapor>
definePageMeta({
  pageTransition: {
    name: 'fade',
    mode: 'out-in',
    onBeforeEnter: () => { (window.__transitionEvents ||= []).push('vapor-page-two:before-enter') },
    onAfterEnter: () => { (window.__transitionEvents ||= []).push('vapor-page-two:after-enter') },
    onBeforeLeave: () => { (window.__transitionEvents ||= []).push('vapor-page-two:before-leave') },
    onAfterLeave: () => { (window.__transitionEvents ||= []).push('vapor-page-two:after-leave') },
  },
})
</script>

<template>
  <div>
    <h1 data-testid="page-title">
      Vapor page two
    </h1>
  </div>
</template>
