'use strict'

const assert = require('assert')
const request = require('request')
const app = require('../src/app')

describe('Feathers application tests', function () {
  before(function (done) {
    this.server = app.listen(3030)
    this.server.once('listening', () => done())
  })

  after(function (done) {
    this.server.close(done)
  })

  it('starts and shows the index page', function (done) {
    request('http://localhost:3030', function (err, res, body) {
      assert.ok(body.indexOf('<h1>Welcome!</h1>') !== -1)
      done(err)
    })
  })

  describe('404', function () {
    it('shows a 404 HTML page', function (done) {
      request({
        url: 'http://localhost:3030/path/to/nowhere',
        headers: {
          'Accept': 'text/html'
        }
      }, function (err, res, body) {
        assert.equal(res.statusCode, 404)
        assert.ok(body.indexOf('This page could not be found.') !== -1)
        done(err)
      })
    })
  })
})
