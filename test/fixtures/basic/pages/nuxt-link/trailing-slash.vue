<script setup lang="ts">
const LinkWithTrailingSlash = defineNuxtLink({
  trailingSlash: 'append'
})
const LinkWithoutTrailingSlash = defineNuxtLink({
  trailingSlash: 'remove'
})
const links = [
  { to: '/', },
  { to: '/nuxt-link/trailing-slash',},
  { to: '/nuxt-link/trailing-slash/',},
  { to: '/nuxt-link/trailing-slash?test=true&thing=other/thing#thing-other',},
  { to: '/nuxt-link/trailing-slash/?test=true&thing=other/thing#thing-other',},
  { to: { name: 'nuxt-link-trailing-slash' },},
  { to: { query: { 'with-state': 'true' }, state: { foo: 'bar' } },},
  { to: { query: { 'without-state': 'true' } }},
  //  Trailing slashes are applied to implicit external links
  { to: 'https://example.com/page.html' },
  // Explicit external links do not when using vue-router object
  { to: { path: 'https://example.com/page.html' }, external: true },
  //  Explicit external links (that are relative) that use vue-router object adds base and trailing slash
  { to: { path: '/foo' }, external: true },
  //  Explicit external for relative path trailing slashes is applied
  { to: '/foo', external: true },
] as const

const route = useRoute()
const windowState = computed(() => {
  if (import.meta.client) {
    console.log(route.fullPath)
    return window.history.state.foo
  }
  return ''
})
</script>

<template>
  <div>
    <h2>window state</h2>
    <div data-testid="window-state">
      <ClientOnly>
        {{ windowState }}
      </ClientOnly>
    </div>
    <h2>Links With Trailing Slash</h2>
    <ul>
      <li
        v-for="(link, index) in links"
        :key="index"
      >
        <LinkWithTrailingSlash
          v-bind="link"
          class="link-with-trailing-slash"
        >
          <LinkWithTrailingSlash
            v-slot="{ href }"
            custom
            v-bind="link"
          >
            {{ href }}
          </LinkWithTrailingSlash>
        </LinkWithTrailingSlash>
      </li>
    </ul>
    <hr>
    <h2>Links Without Trailing Slash</h2>
    <ul>
      <li
        v-for="(link, index) in links"
        :key="index"
      >
        <LinkWithoutTrailingSlash
          v-bind="link"
          class="link-without-trailing-slash"
        >
          <LinkWithoutTrailingSlash
            v-slot="{ href }"
            custom
            v-bind="link"
          >
            {{ href }}
          </LinkWithoutTrailingSlash>
        </LinkWithoutTrailingSlash>
      </li>
    </ul>
    <hr>
    <h2>Nuxt Link</h2>
    <ul>
      <li
        v-for="(link, index) in links"
        :key="index"
      >
        <NuxtLink
          v-bind="link"
          class="nuxt-link"
        >
          <NuxtLink
            v-slot="{ href }"
            custom
            v-bind="link"
          >
            {{ href }}
          </NuxtLink>
        </NuxtLink>
      </li>
    </ul>
    <hr>
    <h2>Router Link</h2>
    <ul>
      <li
        v-for="(link, index) in links"
        :key="index"
      >
        <RouterLink
          v-bind="link"
          class="router-link"
        >
          <RouterLink
            v-slot="{ href }"
            custom
            v-bind="link"
          >
            {{ href }}
          </RouterLink>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
