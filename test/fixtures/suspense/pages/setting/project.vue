<template>
  <div class="test-component">
    <h3 data-testid="project-title">
      Project (level 2)
    </h3>
    <NuxtLink
      to="/setting/project/create"
      data-testid="link-create"
      class="test-button"
    >
      Create (level 3)
    </NuxtLink>
    <NuxtPage />
  </div>
</template>
