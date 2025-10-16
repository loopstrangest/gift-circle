import { io, Socket } from "socket.io-client";

export type ConnectionArgs = {
  roomId: string;
  membershipId: string;
};

let socketInstance: Socket | null = null;

export function connectToRoom(args: ConnectionArgs) {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  socketInstance = io({
    path: "/api/socket",
    withCredentials: true,
    auth: {
      roomId: args.roomId,
      membershipId: args.membershipId,
    },
    transports: ["websocket", "polling"],
  });

  socketInstance.on("disconnect", () => {
    socketInstance = null;
  });

  return socketInstance;
}

export function getSocket() {
  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
