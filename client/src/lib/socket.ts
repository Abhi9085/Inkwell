import { io } from "socket.io-client";
import api from "./api";

const socketUrl = (() => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  const apiUrl = import.meta.env.VITE_API_URL || "/api";

  // Socket.IO is used only in the browser, but this module can also be
  // imported during server rendering.
  if (typeof window === "undefined") {
    return "http://localhost:5000";
  }

  return new URL(apiUrl, window.location.origin).origin;
})();

const readAccessToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
};

console.log("[Socket] Connecting to:", socketUrl);

export const socket = io(socketUrl, {
  autoConnect: false,
  transports: ["websocket"],
  withCredentials: true,
  auth: (callback) => {
    const token = readAccessToken();
    callback(token ? { token } : {});
  },
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

let connectedToken: string | null = null;
let socketRefreshInFlight = false;

socket.on("connect", () => {
  connectedToken = readAccessToken();
});

socket.on("disconnect", () => {
  connectedToken = null;
});

socket.on("connect_error", async (error) => {
  if (socketRefreshInFlight || !/unauthorized|expired|token/i.test(error.message)) return;
  socketRefreshInFlight = true;
  try {
    const response = await api.post("/auth/refresh");
    if (response.data?.token) {
      localStorage.setItem("token", response.data.token);
      socket.disconnect();
      socket.connect();
    }
  } catch {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } finally {
    socketRefreshInFlight = false;
  }
});

/** Connect with the latest short-lived access token. Expired socket auth is refreshed on connect_error. */
export function connectSocket() {
  if (typeof window === "undefined") return;

  const currentToken = readAccessToken();

  // A socket may have first connected before login (or as another account).
  // Reconnect so the server verifies the current user's token.
  if (socket.connected && connectedToken !== currentToken) {
    socket.disconnect();
  }

  if (!socket.connected) {
    socket.connect();
  }
}
