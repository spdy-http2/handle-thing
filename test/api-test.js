var assert = require('assert');
var net = require('net');
var streamPair = require('stream-pair');

var thing = require('../');

describe('Handle Thing', function() {
  var handle;
  var pair;
  var socket;

  [ 'normal', 'lazy' ].forEach(function(mode) {
    describe(mode, function() {
      beforeEach(function() {
        pair = streamPair.create();
        handle = thing.create(mode === 'normal' ? pair.other : null);
        socket = new net.Socket({ handle: handle });

        if (mode === 'lazy') {
          setTimeout(function() {
            handle.setStream(pair.other);
          }, 50);
        }

        // For v0.8
        socket.readable = true;
        socket.writable = true;
      });

      afterEach(function() {
        assert(handle._stream);
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

      if (mode === 'normal') {
        it('should invoke `getPeerName` callback', function() {
          handle._options.getPeerName = function() {
            return { address: 'ohai' };
          };

          assert.equal(socket.remoteAddress, 'ohai');
        });
      }
    });
  });
});
