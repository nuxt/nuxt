---
title: 'Module Author Guide'
titleTemplate: '%s'
description: 'Learn how to create a Nuxt Module to integrate, enhance or extend any Nuxt applications.'
navigation: false
surround: false
---

Nuxt's [configuration](/docs/4.x/api/nuxt-config) and [hooks](/docs/4.x/guide/going-further/hooks) systems make it possible to customize every aspect of Nuxt and add any integration you might need (Vue plugins, CMS, server routes, components, logging, etc.).

**Nuxt Modules** are functions that sequentially run when starting Nuxt in development mode using `nuxt dev` or building a project for production with `nuxt build`.
With modules, you can encapsulate, properly test, and share custom solutions as npm packages without adding unnecessary boilerplate to your project, or requiring changes to Nuxt itself.

::card-group{class="sm:grid-cols-1"}
  ::card{icon="i-lucide-rocket" title="Getting Started" to="/docs/4.x/guide/modules/getting-started"}
  Bootstrap your first Nuxt module using the official starter template.
  ::
  ::card{icon="i-lucide-box" title="Module Anatomy" to="/docs/4.x/guide/modules/module-anatomy"}
  Understand the structure and definition of a Nuxt module.
  ::
  ::card{icon="i-lucide-wrench" title="Tooling" to="/docs/4.x/guide/modules/tooling"}
  Discover the first-party tools to help you build modules.
  ::
  ::card{icon="i-lucide-code" title="Recipes: Injecting Code" to="/docs/4.x/guide/modules/recipes-basics"}
  Learn how to inject plugins, components, composables, and more.
  ::
  ::card{icon="i-lucide-layers" title="Recipes: Hooks & Types" to="/docs/4.x/guide/modules/recipes-advanced"}
  Master hooks, templates, and type declarations.
  ::
  ::card{icon="i-lucide-test-tube" title="Testing" to="/docs/4.x/guide/modules/testing"}
  Test your module with unit, integration, and end-to-end tests.
  ::
  ::card{icon="i-lucide-medal" title="Best Practices" to="/docs/4.x/guide/modules/best-practices"}
  Follow best practices for building performant and maintainable modules.
  ::
  ::card{icon="i-lucide-globe" title="Ecosystem" to="/docs/4.x/guide/modules/ecosystem"}
  Join the Nuxt module ecosystem and share your module with the community.
  ::
::
