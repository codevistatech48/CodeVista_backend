const { Server } = require('socket.io');
const { verifyToken } = require('./jwt');
const env = require('../config/env');

let io;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: env.nodeEnv === 'development' ? true : env.corsOrigins,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('Authentication required'));

    try {
      socket.userId = verifyToken(token).sub;
      next();
    } catch (_error) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(String(socket.userId));
  });

  return io;
}

function getSocketServer() {
  return io;
}

module.exports = { initializeSocket, getSocketServer };
