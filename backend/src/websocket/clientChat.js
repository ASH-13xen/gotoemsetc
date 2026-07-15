const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const clientRepository = require('../repositories/client.repository');
const { canAccessClientChat } = require('../utils/clientAccess');
const logger = require('../utils/logger');

let io = null;

// Per-client chat rooms (not per-task) — a socket only gets pushed messages
// for clients it has explicitly joined, and joining is gated by the same
// chat-access roster (client.chatAllowedEmployees) the REST endpoints use,
// re-verified server-side rather than trusted from the client.
function init(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: [env.frontendUrl, env.salesFrontendUrl, env.followupsFrontendUrl, env.allFrontendUrl] },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      socket.user = {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
        employeeLink: payload.employeeLink || null,
      };
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('client:join', async (clientId, callback) => {
      try {
        const client = await clientRepository.findById(clientId);
        if (!client || !canAccessClientChat(socket.user, client)) {
          return callback?.({ error: 'Not authorized' });
        }
        socket.join(`client:${clientId}`);
        callback?.({ ok: true });
      } catch (err) {
        logger.error({ err, clientId }, 'client:join failed');
        callback?.({ error: 'Failed to join' });
      }
    });

    socket.on('client:leave', (clientId) => {
      socket.leave(`client:${clientId}`);
    });
  });

  return io;
}

// Called by clientChat.controller.js right after a message is persisted via
// REST — pushes it to everyone currently viewing that client's chat.
function broadcastClientMessage(clientId, message) {
  if (!io) return;
  io.to(`client:${clientId}`).emit('client:message', message);
}

module.exports = { init, broadcastClientMessage };
