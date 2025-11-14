import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HttpServer } from "node:http";

import { getRealtimeServer, initializeRealtime } from "@/server/realtime";

type NextApiResponseWithSocket = NextApiResponse & {
  socket: NextApiResponse["socket"] & {
    server: HttpServer & {
      io?: ReturnType<typeof getRealtimeServer>;
    };
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(_req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (!res.socket?.server) {
    res.status(500).end();
    return;
  }

  if (!res.socket.server.io) {
    const io = initializeRealtime(res.socket.server);
    res.socket.server.io = io;
  }

  res.end();
}





