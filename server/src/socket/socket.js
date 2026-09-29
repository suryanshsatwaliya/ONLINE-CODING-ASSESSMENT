import { Server } from "socket.io";
import { env } from "../config/env.js";
import { resolveUser } from "../middleware/auth.middleware.js";
import { setIO } from "../services/realtime.service.js";
import { connectionEvent } from "./assessment.socket.js";
export function attachSocket(server) {
  const io = new Server(server, {
    cors: { origin: env.CLIENT_URL },
    maxHttpBufferSize: 10000,
  });
  setIO(io);
  io.use(async (socket, next) => {
    try {
      socket.user = await resolveUser(socket.handshake.auth.token);
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });
  io.on("connection", (socket) => {
    const u = socket.user;
    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, u.exp * 1000 - Date.now()),
    );
    const recheck = setInterval(
      () =>
        resolveUser(socket.handshake.auth.token).catch(() =>
          socket.disconnect(true),
        ),
      60000,
    );
    if (u.role === "TEACHER") socket.join("teacher:" + u.id);
    else {
      socket.join("student:" + u.id);
      socket.join("assessment:" + u.assessmentId);
      connectionEvent(u, "RECONNECTED").catch(console.error);
    }
    socket.on("disconnect", () => {
      clearTimeout(expiry);
      clearInterval(recheck);
      if (
        u.role === "STUDENT" &&
        !io.sockets.adapter.rooms.get("student:" + u.id)?.size
      )
        connectionEvent(u, "DISCONNECTED").catch(console.error);
    });
  });
  return io;
}
