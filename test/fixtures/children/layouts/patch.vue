<template>
  <div>
    <nuxt/>
    <ul>
      <li><nuxt-link data-test-id="patch" to="/patch">/patch</nuxt-link></li>
      <li><nuxt-link data-test-id="patch-id-1" to="/patch/1">/patch/1</nuxt-link></li>
      <li><nuxt-link data-test-id="patch-id-2" to="/patch/2">/patch/2</nuxt-link></li>
      <li><nuxt-link data-test-id="patch-id-2" to="/patch/2#test">/patch/2#test</nuxt-link></li>
      <li><nuxt-link data-test-id="patch-id-child" to="/patch/2/child">/patch/2/child</nuxt-link></li>
      <li><nuxt-link data-test-id="patch-id-2-child-1" to="/patch/2/child/1">/patch/2/child/1</nuxt-link></li>
      <li><nuxt-link data-test-id="patch-id-2-child-1" to="/patch/2/child/1?query=true">/patch/2/child/1?query=true</nuxt-link></li>
      <li><nuxt-link data-test-id="patch-id-2-child-1" to="/patch/2/child/1?query=true#test">/patch/2/child/1?query=true#test</nuxt-link></li>
    </ul>
  </div>
</template>
