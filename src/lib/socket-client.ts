import { io, Socket } from "socket.io-client";

export type ConnectionArgs = {
  roomId: string;
  membershipId?: string;
};

let socketInstance: Socket | null = null;

export function connectToRoom(args: ConnectionArgs) {
  if (socketInstance) {
    const sameRoom = socketInstance.auth?.roomId === args.roomId;
    const sameMembership = socketInstance.auth?.membershipId === args.membershipId;
    if (sameRoom && sameMembership) {
      return socketInstance;
    }

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

export function onRoomSocketConnect(callback: () => void) {
  if (!socketInstance) {
    return;
  }
  socketInstance.once("connect", callback);
}

export function onRoomEvent<T>(event: string, callback: (payload: T) => void) {
  if (!socketInstance) {
    return;
  }
  socketInstance.on(event, callback as (payload: unknown) => void);
}

export function offRoomEvent<T>(event: string, callback: (payload: T) => void) {
  if (!socketInstance) {
    return;
  }
  socketInstance.off(event, callback as (payload: unknown) => void);
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
