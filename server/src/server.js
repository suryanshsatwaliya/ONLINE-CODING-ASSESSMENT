import http from "node:http";
import mongoose from "mongoose";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { attachSocket } from "./socket/socket.js";
import { startWorker } from "./services/worker.service.js";
await connectDB();
const server = http.createServer(app);
const io = attachSocket(server);
const stop = startWorker();
server.listen(env.PORT, () =>
  console.log("Assessment API listening on " + env.PORT),
);
async function shutdown() {
  stop();
  io.close();
  server.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
