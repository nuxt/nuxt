# Nuxt with Loki.js 

This demo showcases building CRUD app with embedded json database
[Loki.js](http://lokijs.org/) and featuring Vuetify. Also it uses Nuxt ServerMiddleware
and Express Router for creating a CRUD api.

  We use two (anti)patterns for communicating with DB.

* Through Vuex Store (Note, this is going to DB on every SSR)
* Through `/api` middleware doing all the DB CRUD comms
 
 [Try demo on codesabndBox](https://codesandbox.io/s/lr9or04n67)

## Build Setup

``` bash
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
