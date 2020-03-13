<template>
  <div>
    <Nuxt />
    <ul>
      <li>
        <NuxtLink data-test-id="patch" to="/patch">
          /patch
        </NuxtLink>
      </li>
      <li>
        <NuxtLink data-test-id="patch-id-1" to="/patch/1">
          /patch/1
        </NuxtLink>
      </li>
      <li>
        <NuxtLink data-test-id="patch-id-2" to="/patch/2">
          /patch/2
        </NuxtLink>
      </li>
      <li>
        <NuxtLink data-test-id="patch-id-2" to="/patch/2#test">
          /patch/2#test
        </NuxtLink>
      </li>
      <li>
        <NuxtLink data-test-id="patch-id-child" to="/patch/2/child">
          /patch/2/child
        </NuxtLink>
      </li>
      <li>
        <NuxtLink data-test-id="patch-id-2-child-1" to="/patch/2/child/1">
          /patch/2/child/1
        </NuxtLink>
      </li>
      <li>
        <NuxtLink data-test-id="patch-id-2-child-1" to="/patch/2/child/1?query=true">
          /patch/2/child/1?query=true
        </NuxtLink>
      </li>
      <li>
        <NuxtLink data-test-id="patch-id-2-child-1" to="/patch/2/child/1?query=true#test">
          /patch/2/child/1?query=true#test
        </NuxtLink>
      </li>
      <li>
        <NuxtLink data-test-id="patch-id-2-reuse" to="/patch/2/reuse">
          /patch/2/reuse
        </NuxtLink>
      </li>
      <li>
        <NuxtLink data-test-id="patch-id-2-reuse-2" to="/patch/2/reuse/1">
          /patch/2/reuse/1
        </NuxtLink>
      </li>
      <li>
        <NuxtLink data-test-id="patch-id-2-reuse-2" to="/patch/2/reuse/2">
          /patch/2/reuse/2
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
