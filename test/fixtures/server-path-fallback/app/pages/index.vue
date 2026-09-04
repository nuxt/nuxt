<template>
  <div>
    <h1>Server path fallback</h1>
    <NuxtLink
      id="asset"
      to="/proposal.txt"
    >asset</NuxtLink>
    <NuxtLink
      id="page"
      to="/about"
    >about</NuxtLink>
    <NuxtLink
      id="missing"
      to="/definitely-not-a-route"
    >missing</NuxtLink>
    <NuxtLink
      id="server-route"
      to="/rss.xml"
    >server route</NuxtLink>
    <NuxtLink
      id="dynamic-server-route"
      to="/og/hello"
    >dynamic server route</NuxtLink>
    <NuxtLink
      id="post-only-server-route"
      to="/subscribe"
    >post-only server route</NuxtLink>
    <!--
      `/changelog` is a false positive of the filter built from this fixture, asserted in
      `packages/nuxt/test/server-path-filter.test.ts`.
    -->
    <NuxtLink
      id="collision"
      to="/changelog"
    >collision</NuxtLink>
  </div>
</template>
