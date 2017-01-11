'use strict';
const authentication = require('./authentication');
const user = require('./user');

module.exports = function() {
  const app = this;
  
  
  app.configure(authentication);
  app.configure(user);
};
