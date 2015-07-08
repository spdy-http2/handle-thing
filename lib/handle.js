var util = require('util');

var Buffer = require('buffer').Buffer;

// Node.js version
var mode = /^v0\.8\./.test(process.version) ? 'rusty' :
           /^v0\.(9|10)\./.test(process.version) ? 'old' :
           'modern';

function Handle(stream, options) {
  this._stream = stream;
  this._flowing = false;
  this._options = options || {};

  this.onread = null;

  // Start handle once `onread` is set
  if (mode === 'rusty') {
    var self = this;
    Object.defineProperty(this, 'onread', {
      set: function(value) {
        Object.defineProperty(self, 'onread', {
          value: value
        });
        process.nextTick(function() {
          self.readStart();
        });
      }
    });
  }

  if (mode !== 'modern')
    this.writeQueueSize = 1;
}
module.exports = Handle;

Handle.create = function create(stream, options) {
  return new Handle(stream, options);
};

Handle.prototype.readStart = function readStart() {
  this._stream.resume();
  if (this._flowing)
    return;
  this._flowing = true;

  this._flow();
};

if (mode === 'modern') {
  var uv = process.binding('uv');

  Handle.prototype._flow = function flow() {
    var self = this;
    this._stream.on('data', function(chunk) {
      self.onread(chunk.length, chunk);
    });

    this._stream.on('end', function() {
      self.onread(uv.UV_EOF, new Buffer(0));
    });
  };
} else if (mode === 'old') {
  Handle.prototype._flow = function flow() {
    var self = this;
    this._stream.on('data', function(chunk) {
      self.onread(chunk, 0, chunk.length);
    });

    this._stream.on('end', function() {
      var errno = process._errno;
      process._errno = 'EOF';
      self.onread(null, 0, 0);
      if (process._errno === 'EOF')
        process._errno = errno;
    });
  };
} else {
  Handle.prototype._flow = function flow() {
    var self = this;
    this._stream.on('data', function(chunk) {
      self.onread(chunk, 0, chunk.length);
    });

    this._stream.on('end', function() {
      debugger;
      var errno = global.errno;
      global.errno = 'EOF';
      self.onread(null, 0, 0);
      if (global.errno === 'EOF')
        global.errno = errno;
    });
  };
}

Handle.prototype.readStop = function readStop() {
  this._stream.pause();
};

if (mode === 'modern') {
  Handle.prototype.shutdown = function shutdown(req) {
    var self = this;
    this._stream.end(function() {
      req.oncomplete(0, self, req);
    });
  };
} else {
  Handle.prototype.shutdown = function shutdown(req) {
    var req = {};
    var self = this;
    this._stream.end(function() {
      req.oncomplete(0, self, req);
    });
    return req;
  };
}

if (mode !== 'rusty') {
  Handle.prototype.close = function close(callback) {
    if (this._options.close)
      return this._options.close(callback);
    process.nextTick(callback);
  };
} else {
  Handle.prototype.close = function close() {
    if (this._options.close)
      return this._options.close(function() {});
  };
}

if (mode === 'modern') {
  Handle.prototype.writeEnc = function writeEnc(req, data, enc) {
    var self = this;
    req.async = true;
    this._stream.write(data, enc, function() {
      req.oncomplete(0, self, req);
    });
  };
} else {
  Handle.prototype.writeEnc = function writeEnc(data, ignored, enc) {
    var self = this;
    var buffer = new Buffer(data, enc);
    var req = { bytes: buffer.length };
    this._stream.write(buffer, function() {
      req.oncomplete(0, self, req);
    });
    return req;
  };
}

Handle.prototype.writeBuffer = function writeBuffer(req, data) {
  return this.writeEnc(req, data, null);
};

Handle.prototype.writeAsciiString = function writeAsciiString(req, data) {
  return this.writeEnc(req, data, 'ascii');
};

Handle.prototype.writeUtf8String = function writeUtf8String(req, data) {
  return this.writeEnc(req, data, 'utf8');
};

Handle.prototype.writeUcs2String = function writeUcs2String(req, data) {
  return this.writeEnc(req, data, 'ucs2');
};

Handle.prototype.writeBinaryString = function writeBinaryString(req, data) {
  return this.writeEnc(req, data, 'binary');
};

// v0.8
Handle.prototype.getsockname = function getsockname() {
  if (this._options.getPeerName)
    return this._options.getPeerName();
  return null;
};

if (mode === 'modern') {
  Handle.prototype.getpeername = function getpeername(out) {
    var res = this.getsockname();
    if (!res)
      return -1;

    Object.keys(res).forEach(function(key) {
      out[key] = res[key];
    });

    return 0;
  };
} else {
  // v0.10
  Handle.prototype.getpeername = function getpeername() {
    return this.getsockname();
  };
}
