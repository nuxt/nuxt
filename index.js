/*
** Nuxt.js
** Made by Chopin Brothers
** @Atinux & @alexchopin
*/

// Until babel-loader 7 is released
process.noDeprecation = true

var Nuxt = require('./dist/nuxt.js')

module.exports = Nuxt.default ? Nuxt.default : Nuxt
