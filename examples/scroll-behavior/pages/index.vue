<template>
  <div class="container">
    <h1>Home page</h1>
    <p>
      <NuxtLink to="/about">
        About page
      </NuxtLink>
    </p>
    <p>
      <NuxtLink to="/users">
        Lists of users
      </NuxtLink>
    </p>
    <p>
      <NuxtLink to="/long">
        Long page
      </NuxtLink>
    </p>
    <p>
      <NuxtLink to="/long#anchor">
        Long page #anchor
      </NuxtLink>
    </p>
    <div class="spacer" style="width: 100%; height: 3000px; background: grey" />
    <p>
      <NuxtLink to="/another-long">
        Another long page
      </NuxtLink>
    </p>
  </div>
</template>
