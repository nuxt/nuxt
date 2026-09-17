<script setup lang="ts">
definePageMeta({
  pageTransition: {
    name: 'page',
    mode: 'out-in',
    onBeforeEnter: () => { (window.__transitionEvents ||= []).push('vdom-page:before-enter') },
    onAfterEnter: () => { (window.__transitionEvents ||= []).push('vdom-page:after-enter') },
    onBeforeLeave: () => { (window.__transitionEvents ||= []).push('vdom-page:before-leave') },
    onAfterLeave: () => { (window.__transitionEvents ||= []).push('vdom-page:after-leave') },
  },
})
</script>

<template>
  <div>
    <h1 data-testid="page-title">
      VDOM page
    </h1>
  </div>
</template>
