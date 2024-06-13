<script setup lang="ts">
const MyLink = defineNuxtLink({
  componentName: 'MyLink',
  trailingSlash: 'append',
})
</script>

<template>
  <div>
    <div>
      <MyLink to="https://thehackernews.com/2024/01/urgent-upgrade-gitlab-critical.html">
        Trailing slashes should not be applied to implicit external links
      </MyLink>
    </div>
    <div>
      <NuxtLink
        :to="{ path: 'https://thehackernews.com/2024/01/urgent-upgrade-gitlab-critical.html' }"
        external
      >
        External links within route objects should be respected and not have trailing slashes applied
      </NuxtLink>
    </div>
    <div>
      <MyLink
        :to="{ path: '/missing-page' }"
        external
      >
        External links within route objects should be respected and have trailing slashes applied
      </MyLink>
    </div>
    <div>
      <MyLink
        to="/missing-page"
        external
      >
        External links should be respected and have trailing slashes applied
      </MyLink>
    </div>
    <div>
      <NuxtLink
        custom
        to="https://google.com"
        external
      >
        <template #default="{ navigate }">
          <button @click="navigate()">
            Using navigate() with external link should work
          </button>
        </template>
      </NuxtLink>
    </div>
  </div>
</template>
