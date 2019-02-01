# PM2 with nuxt-ts example

[Gracefull zero-downtime restart](https://pm2.io/doc/en/runtime/best-practices/graceful-shutdown/#graceful-start)

`ecosystem.config.js` -  configuration file for pm2

`listen_timeout` option depends on your need

## Zero-downtime deployment
*all depends on your deployment method. It's just example

#### Directories:
- `$PROJECT_ROOT` - your project root path on server
- `/current` - root dir for nginx(if you are using [proxy configuration](https://nuxtjs.org/faq/nginx-proxy/))
- `/_tmp` - Temporary dir to install and build project
- `/_old` - Previous build. Can be useful for fast reverting

#### Steps:
- deploy project to $PROJECT_ROOT/_tmp
- `cd $PROJECT_ROOT/_tmp`
- `npm i`
- `nuxt build` or if you are using TypeScript `nuxt-ts build`
- `mv $PROJECT_ROOT/current $PROJECT_ROOT/_old`
- `mv $PROJECT_ROOT/_tmp $PROJECT_ROOT/current`
- `cd $PROJECT_PATH/current`
- `pm2 startOrReload ecosystem.config.js`
