import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  });

  io.on('connection', (socket) => {
    socket.emit('system:connected', {
      status: 'CONNECTED',
      protocol: 'Socket.IO v4 + MQTT Bridge',
      timestamp: new Date().toISOString()
    });

    socket.on('device:command', (payload) => {
      // Forwarded through service layer if invoked directly over socket
      socket.broadcast.emit('device:command_ack', payload);
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}

export function broadcastEvent(event: string, data: any): void {
  if (io) {
    io.emit(event, data);
  }
}
