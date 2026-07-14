const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const taskRepository = require('../repositories/task.repository');
const clientRepository = require('../repositories/client.repository');
const { canAccessClientTasks } = require('../utils/clientAccess');
const logger = require('../utils/logger');

let io = null;

// Per-task chat rooms — a socket only gets pushed messages for tasks it has
// explicitly joined, and joining is gated by the exact same client-access
// check the REST endpoints use, re-verified server-side rather than trusted
// from the client.
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
    socket.on('task:join', async (taskId, callback) => {
      try {
        const task = await taskRepository.findRaw(taskId);
        if (!task) return callback?.({ error: 'Task not found' });
        const client = await clientRepository.findById(task.client);
        if (!client || !canAccessClientTasks(socket.user, client)) {
          return callback?.({ error: 'Not authorized' });
        }
        socket.join(`task:${taskId}`);
        callback?.({ ok: true });
      } catch (err) {
        logger.error({ err, taskId }, 'task:join failed');
        callback?.({ error: 'Failed to join' });
      }
    });

    socket.on('task:leave', (taskId) => {
      socket.leave(`task:${taskId}`);
    });
  });

  return io;
}

// Called by task.controller.js right after a message is persisted via REST
// — pushes it to everyone currently viewing that task.
function broadcastTaskMessage(taskId, message) {
  if (!io) return;
  io.to(`task:${taskId}`).emit('task:message', message);
}

module.exports = { init, broadcastTaskMessage };
