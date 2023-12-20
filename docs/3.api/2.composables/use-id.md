---
title: "useId"
description: Generate a ssr-friendly unique Id that can be passed to accessibility attributes.
---

`useId` generates a ssr-friendly unique Id that can be passed to accessibility attributes.

Call `useId` at the top level of your component to generate a unique ID:

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

`useId` returns a unique ID string associated with this particulat `useId` call in this particular component.
