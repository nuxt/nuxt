---
title: 'Nuxt Directory Structure'
description: 'Learn about the directory structure of a Nuxt application and how to use it.'
navigation: false
---

Nuxt applications have a specific directory structure that is used to organize the code. This structure is designed to be easy to understand and to be used in a consistent way.

## Root Directory

The root directory of a Nuxt application is the directory that contains the `nuxt.config.ts` file. This file is used to configure the Nuxt application.

### App Directory & Files

The following directories are related to the universal Nuxt application:
- [`assets/`](/docs/3.x/directory-structure/assets): website's assets that the build tool (Vite or webpack) will process
- [`components/`](/docs/3.x/directory-structure/components): Vue components of the application
- [`composables/`](/docs/3.x/directory-structure/composables): add your Vue composables
- [`layouts/`](/docs/3.x/directory-structure/layouts): Vue components that wrap around your pages and avoid re-rendering between pages
- [`middleware/`](/docs/3.x/directory-structure/middleware): run code before navigating to a particular route
- [`pages/`](/docs/3.x/directory-structure/pages): file-based routing to create routes within your web application
- [`plugins/`](/docs/3.x/directory-structure/plugins): use Vue plugins and more at the creation of your Nuxt application
- [`utils/`](/docs/3.x/directory-structure/utils): add functions throughout your application that can be used in your components, composables, and pages.

This directory also includes specific files:
- [`app.config.ts`](/docs/3.x/directory-structure/app/app-config): a reactive configuration within your application
- [`app.vue`](/docs/directory-structure/app/app-vue): the root component of your Nuxt application
- [`error.vue`](/docs/directory-structure/app/error): the error page of your Nuxt application

### Server Directory

The [`server/`](/docs/3.x/directory-structure/server) directory is the directory that contains the server-side code of the Nuxt application. It contains the following subdirectories:
- [`api/`](/docs/3.x/directory-structure/server#server-routes): contains the API routes of the application.
- [`routes/`](/docs/3.x/directory-structure/server#server-routes): contains the server routes of the application (e.g. dynamic `/sitemap.xml`).
- [`middleware/`](/docs/3.x/directory-structure/server#server-middleware): run code before a server route is processed
- [`plugins/`](/docs/3.x/directory-structure/server#server-plugins): use plugins and more at the creation of the Nuxt server
- [`utils/`](/docs/3.x/directory-structure/server#server-utilities): add functions throughout your application that can be used in your server  code.


## Public Directory

The [`public/`](/docs/3.x/directory-structure/public) directory is the directory that contains the public files of the Nuxt application. Files contained within this directory are served at the root and are not modified by the build process.

This is suitable for files that have to keep their names (e.g. `robots.txt`) _or_ likely won't change (e.g. `favicon.ico`).

## Shared Directory

The [`shared/`](/docs/3.x/directory-structure/shared) directory is the directory that contains the shared code of the Nuxt application and Nuxt server. This code can be used in both the Vue app and the Nitro server.

## Content Directory

The [`content/`](/docs/3.x/directory-structure/content) directory is enabled by the [Nuxt Content](https://content.nuxt.com) module. It is used to create a file-based CMS for your application using Markdown files.

## Modules Directory

The [`modules/`](/docs/3.x/directory-structure/modules) directory is the directory that contains the local modules of the Nuxt application. Modules are used to extend the functionality of the Nuxt application.

## Layers Directory

The [`layers/`](/docs/3.x/directory-structure/layers) directory is the directory that contains the layers of the Nuxt application. Layers are used to extend the functionality of the Nuxt application.

## Nuxt Files

- [`nuxt.config.ts`](/docs/3.x/directory-structure/nuxt-config) file is the main configuration file for the Nuxt application.
- [`.nuxtrc`](/docs/3.x/directory-structure/nuxtrc) file is another syntax for configuring the Nuxt application (useful for global configurations).
- [`.nuxtignore`](/docs/3.x/directory-structure/nuxtignore) file is used to ignore files in the root directory during the build phase.

