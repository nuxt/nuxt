# Nuxt with [Socket.io](https://socket.io/)

An example for Nuxt.js with WebSockets over Socket.io.

> Socket.IO enables real-time, bidirectional and event-based communication.
> It works on every platform, browser or device, focusing equally on reliability and speed.

* Do you use Nuxt programmatically (eg. with Express or Koa)? Take a look into [`server.js`](./server.js) for setting up WS with your implementation

* In case you use Nuxt standalone, check out [`nuxt.config.js`](./nuxt.config.js) and the [io-module](./io/index.js)

* In both situations you should look into the [`index.vue`](./pages/index.vue) where sending and receiving messages is done
