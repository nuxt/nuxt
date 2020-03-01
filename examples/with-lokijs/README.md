# Nuxt with Loki.js

This demo showcases building CRUD app with embedded json database
[Loki.js](http://lokijs.org/) and featuring Vuetify. Also it uses Nuxt ServerMiddleware, new Fetch, local modules, hooks and
Express Router for creating a CRUD api.

We use two (anti)patterns for communicating with DB.

- VUEX SSR - Through Vuex Store initialised on server
- Hybrid - Using Axios on client and db calls on server
- CRUD with AsyncData - Through _/api_ middleware doing all the DB CRUD communication
- CRUD with new Fetch - Through _/api_ middleware doing all the DB CRUD communication

[Try demo on codesabndBox](https://codesandbox.io/s/lr9or04n67)

## Build Setup

```bash
# install dependencies
$ yarn install

# serve with hot reload at localhost:3000
$ yarn run dev

# build for production and launch server
$ yarn run build
$ yarn start

# generate static project
$ yarn run generate
```
