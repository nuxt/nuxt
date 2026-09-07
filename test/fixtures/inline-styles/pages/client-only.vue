<template>
  <main>
    client only
    <NuxtLink
      to="/shared-a"
      :prefetch="false"
    >
      shared a
    </NuxtLink>
    <ClientOnly>
      <SharedBox />
    </ClientOnly>
  </main>
</template>
