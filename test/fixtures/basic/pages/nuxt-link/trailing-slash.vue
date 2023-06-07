<script setup lang="ts">
const LinkWithTrailingSlash = defineNuxtLink({
  trailingSlash: 'append'
})
const LinkWithoutTrailingSlash = defineNuxtLink({
  trailingSlash: 'remove'
})
const links = [
  '/',
  '/nuxt-link/trailing-slash',
  '/nuxt-link/trailing-slash/',
  '/nuxt-link/trailing-slash?test=true&thing=other/thing#thing-other',
  '/nuxt-link/trailing-slash/?test=true&thing=other/thing#thing-other',
  { name: 'nuxt-link-trailing-slash' },
  { query: { 'with-state': 'true' }, state: { foo: 'bar' } },
  { query: { 'without-state': 'true' } }
] as const

const route = useRoute()
const windowState = computed(() => {
  console.log(route.fullPath)
  return process.client ? window.history.state.foo : ''
})
</script>

<template>
  <div>
    <div data-testid="window-state">
      <ClientOnly>
        {{ windowState }}
      </ClientOnly>
    </div>
    <ul>
      <li v-for="(link, index) in links" :key="index">
        <LinkWithTrailingSlash :to="link" class="link-with-trailing-slash">
          <LinkWithTrailingSlash v-slot="{ href }" custom :to="link">
            {{ href }}
          </LinkWithTrailingSlash>
        </LinkWithTrailingSlash>
      </li>
    </ul>
    <hr>
    <ul>
      <li v-for="(link, index) in links" :key="index">
        <LinkWithoutTrailingSlash :to="link" class="link-without-trailing-slash">
          <LinkWithoutTrailingSlash v-slot="{ href }" custom :to="link">
            {{ href }}
          </LinkWithoutTrailingSlash>
        </LinkWithoutTrailingSlash>
      </li>
    </ul>
    <hr>
    <ul>
      <li v-for="(link, index) in links" :key="index">
        <NuxtLink :to="link" class="nuxt-link">
          <NuxtLink v-slot="{ href }" custom :to="link">
            {{ href }}
          </NuxtLink>
        </NuxtLink>
      </li>
    </ul>
    <hr>
    <ul>
      <li v-for="(link, index) in links" :key="index">
        <RouterLink :to="link" class="router-link">
          <RouterLink v-slot="{ href }" custom :to="link">
            {{ href }}
          </RouterLink>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
