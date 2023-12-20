---
title: "useId"
description: Generate an SSR-friendly unique identifier that can be passed to accessibility attributes.
---

`useId` generates an SSR-friendly unique identifier that can be passed to accessibility attributes.

Call `useId` at the top level of your component to generate a unique string identifier:

```vue [components/EmailField.vue]
<script setup lang="ts">
const id = useId()
</script>

<template>
  <div>
    <label :for="id">Email</label>
    <input :id="id" name="email" type="email"/>
  </div>
</template>
```

## Parameters

`useId` does not take any parameters.

## Returns

`useId` returns a unique string associated with this particular `useId` call in this particular component.
