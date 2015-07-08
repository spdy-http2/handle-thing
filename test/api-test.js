var assert = require('assert');
var net = require('net');
var streamPair = require('stream-pair');

var thing = require('../');

describe('Handle Thing', function() {
  var handle;
  var pair;
  var socket;


  beforeEach(function() {
    pair = streamPair.create();
    handle = thing.create(pair.other);
    socket = new net.Socket({ handle: handle });

    // For v0.8
    socket.readable = true;
    socket.writable = true;
  });

  it('should write data to Socket', function(done) {
    pair.write('hello');
    pair.write(' world');
    pair.end('... ok');

    var chunks = '';
    socket.on('data', function(chunk) {
      chunks += chunk;
    });
    socket.on('end', function() {
      assert.equal(chunks, 'hello world... ok');

      // allowHalfOpen is `false`, so the `end` should be followed by `close`
      socket.once('close', function() {
        done();
      });
    });
  });

  it('should read data from Socket', function(done) {
    socket.write('hello');
    socket.write(' world');
    socket.end('... ok');

    var chunks = '';
    pair.on('data', function(chunk) {
      chunks += chunk;
    });
    pair.on('end', function() {
      assert.equal(chunks, 'hello world... ok');

      done();
    });
  });

  it('should invoke `close` callback', function(done) {
    handle._options.close = function(callback) {
      done();
      process.nextTick(callback);
    };

    pair.end('hello');
    socket.resume();
  });

  it('should invoke `getPeerName` callback', function() {
    handle._options.getPeerName = function() {
      return { address: 'ohai' };
    };

    assert.equal(socket.remoteAddress, 'ohai');
  });
});
