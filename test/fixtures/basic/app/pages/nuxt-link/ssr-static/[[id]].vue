<script setup lang="ts">
import { NuxtLink as DynamicNuxtLink } from '#components'
</script>

<template>
  <div id="ssr-static-links">
    <NuxtLink to="/nuxt-link/ssr-static">self</NuxtLink>
    <NuxtLink to="/nuxt-link/ssr-static/">self-slash</NuxtLink>
    <NuxtLink to="/nuxt-link/ssr-static/abc">child</NuxtLink>
    <NuxtLink to="/Nuxt-Link/ssr-static">self-case</NuxtLink>
    <NuxtLink to="/">root</NuxtLink>
    <NuxtLink :to="{ path: '/nuxt-link/ssr-static' }">object</NuxtLink>
    <NuxtLink to="/nuxt-link/ssr-static?x=1">query</NuxtLink>
    <NuxtLink to="/nuxt-link/a%20b">encoded</NuxtLink>
    <NuxtLink
      to="/nuxt-link/ssr-static/abc"
      class="foo"
      :style="{ color: 'red' }"
    >class-style</NuxtLink>
    <NuxtLink
      to="/nuxt-link/ssr-static/abc"
      rel="no&quot;follow"
      active-class="act"
      aria-current-value="step"
    >attrs</NuxtLink>
    <NuxtLink to="/nuxt-link/ssr-static/a&quot;b">escaped</NuxtLink>
    <NuxtLink to="https://example.com/">external</NuxtLink>
    <NuxtLink
      :to="{ path: 'https://example.com/x' }"
      external
    >external-object</NuxtLink>
    <NuxtLink
      to="/x"
      external
    >external-bool</NuxtLink>
    <NuxtLink to="//example.com/x">protocol-relative</NuxtLink>
    <NuxtLink
      to="/x"
      target="_blank"
    >blank</NuxtLink>
    <NuxtLink
      to="/x"
      replace
    >replace</NuxtLink>
    <NuxtLink to="#hash">hash</NuxtLink>
    <NuxtLink to="">empty</NuxtLink>
    <NuxtLink href="/href">href</NuxtLink>
    <NuxtLink
      v-slot="{ route, href, isActive, isExactActive }"
      to="/nuxt-link/ssr-static"
      custom
    ><span>{{ route.path }}|{{ href }}|{{ isActive }}|{{ isExactActive }}</span></NuxtLink>
    <NuxtLink
      v-slot="{ route, isActive }"
      to="/nuxt-link/ssr-static/abc"
    ><span>{{ route.name }}|{{ isActive }}</span></NuxtLink>
    <NuxtLink to="/nuxt-link/ssr-static"><NuxtLink to="/">nested</NuxtLink></NuxtLink>
    <NuxtLink
      to="/nuxt-link/ssr-static"
      @click="() => {}"
    >listener</NuxtLink>
    <NuxtLink to="/nuxt-link/ssr-static/abc"><!-- only a comment --></NuxtLink>
    <NuxtLink to="/nuxt-link/ssr-static/abc"><SsrLinkAsyncText /></NuxtLink>
    <component
      :is="DynamicNuxtLink"
      to="/nuxt-link/ssr-static/abc"
    >
      dynamic
    </component>
    <NuxtLink
      to="/nuxt-link/ssr-static/abc"
      active-class="same"
      exact-active-class="same"
    >same-class</NuxtLink>
    <NuxtLink
      to="/nuxt-link/ssr-static"
      active-class="same"
      exact-active-class="same"
    >same-class-parent</NuxtLink>
    <NuxtLink
      v-for="path in ['/', '/nuxt-link/ssr-static/abc']"
      :key="path"
      :to="path"
    >list</NuxtLink>
    <SsrLinkScopedSlot><NuxtLink to="/nuxt-link/ssr-static/abc">slotted</NuxtLink></SsrLinkScopedSlot>
  </div>
</template>

<style scoped>
a { color: inherit }
</style>
