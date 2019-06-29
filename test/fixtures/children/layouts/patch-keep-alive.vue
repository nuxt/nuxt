<template>
  <div>
    <Nuxt keep-alive :keep-alive-props="{include:'KeepAlive'}" />
    <ul>
      <li>
        <NuxtLink to="/patch-keep-alive">
          /patch-keep-alive
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/patch-keep-alive/keep-alive">
          /patch-keep-alive/keep-alive
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
