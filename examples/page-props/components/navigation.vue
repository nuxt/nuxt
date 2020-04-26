<template>
  <ul>
    <li>
      <NuxtLink :to="{path: '/', query: {layout: 'other'}}">
        (other)
      </NuxtLink>
      <NuxtLink :to="{path: '/', query: {layout: 'keepAlife'}}">
        (keepAlife)
      </NuxtLink>
      <NuxtLink :to="{path: '/'}">
        Index
      </NuxtLink>
    </li>
    <li>
      <NuxtLink :to="{path: '/page-with-prop', query: {layout: 'other'}}">
        (other)
      </NuxtLink>
      <NuxtLink :to="{path: '/page-with-prop', query: {layout: 'keepAlife'}}">
        (keepAlife)
      </NuxtLink>
      <NuxtLink :to="{path: '/page-with-prop'}">
        Page with Prop
      </NuxtLink>
    </li>
    <li>
      <NuxtLink :to="{path: '/page-without-prop', query: {layout: 'other'}}">
        (other)
      </NuxtLink>
      <NuxtLink :to="{path: '/page-without-prop', query: {layout: 'keepAlife'}}">
        (keepAlife)
      </NuxtLink>
      <NuxtLink :to="{path: '/page-without-prop'}">
        Page without Prop
      </NuxtLink>
    </li>
  </ul>
</template>
