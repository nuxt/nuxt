<script setup>
const links = new Set(['sync', 'async'].flatMap(parent => [1, 2].flatMap(p => ['sync', 'async'].flatMap(child => [null, 1, 2].map(c => !c ? `/suspense/${parent}-${p}/` : `/suspense/${parent}-${p}/${child}-${c}/`)))))

definePageMeta({
// Nested <Suspense> + <Transition> is still buggy
  pageTransition: false,
  layoutTransition: false,
  middleware: (to) => {
    if ('layout' in to.query) {
      if (to.query.layout === 'false') {
        to.meta.layout = false
      } else {
        to.meta.layout = to.query.layout
      }
    }
  }
})
</script>

<template>
  <div>
    This exists to test synchronous transitions between nested Suspense components.
    <hr>
    <div style="display: flex; flex-direction: row; gap: 10vw;">
      <div>
        <h1>With extended layout</h1>
        <NuxtLink
          v-for="link in links"
          :key="link"
          :to="link"
          style="display: block;"
        >
          {{ link }}
        </NuxtLink>
      </div>
      <div>
        <h1>With custom layout</h1>
        <NuxtLink
          v-for="link in links"
          :key="link"
          :to="`${link}?layout=custom`"
          style="display: block;"
        >
          {{ link }}
        </NuxtLink>
      </div>
    </div>
    <NuxtLink to="/internal-layout/async-parent/child">
      Internal layout page
    </NuxtLink>
    <hr>
    <div>
      <NuxtPage />
    </div>
  </div>
</template>
