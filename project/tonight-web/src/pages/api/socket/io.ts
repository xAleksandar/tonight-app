import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'node:http';
import type { Socket as NetSocket } from 'node:net';
import type { Server as IOServer } from 'socket.io';

import { socketService } from '@/lib/socket';

type HTTPServerWithIO = HTTPServer & {
  io?: IOServer;
};

type NextApiResponseServerIO = NextApiResponse & {
  socket: NetSocket & {
    server: HTTPServerWithIO;
  };
};

function ensureSocketServer(res: NextApiResponseServerIO): IOServer {
  const { server } = res.socket;

  if (!server.io) {
    server.io = socketService.initialize(server);
  }

  return server.io;
}

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO): void {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    ensureSocketServer(res);
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to initialize Socket.IO server';
    res.status(500).json({ error: message });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
