import { io, Socket } from "socket.io-client";

import { SOCKET_URL } from "./config";

class SocketService {
  private socket: Socket | null = null;

  public connect(): Socket {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        transports: ["websocket"],
        autoConnect: true,
      });

      this.socket.on("connect", () => {
        console.log("[Client] Connected to Void Server:", this.socket?.id);
      });

      this.socket.on("disconnect", () => {
        console.log("[Client] Disconnected from Void Server.");
      });
    }
    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
