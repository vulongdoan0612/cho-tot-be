import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import userRouter from "./routes/userRoutes.js";
import formPostRouter from "./routes/formPostRoutes.js";
import adminRouter from "./routes/adminCMS.js";
import favPostRouter from "./routes/favPost.js";
import chatRouter from "./routes/chat.js";
import paymentRouter from "./routes/payment.js";
import http from "http";
import { WebSocket, WebSocketServer } from "ws";

dotenv.config();

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to database");
  })
  .catch((err) => {
    console.log(err.message);
  });

const app = express();

app.use(express.json());

const port = 5000;

const wss = new WebSocketServer({ port: 443, path: "/ws" });

wss.on("connection", (ws) => {
  console.log("New WebSocket client connected");

  ws.on("message", (message) => {
    console.log("Received:", message);
    // Xử lý message từ client
  });

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

export const webSocketChat = (action, idRoom) => {
  const message = JSON.stringify({ action, idRoom });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};
export const sendAnnouce = (action, userId, announce) => {
  const message = JSON.stringify({ action, userId, announce });

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};
app.use(express.urlencoded({ extended: true }));
const corsOptions = {
  origin: "https://cho-tot-fresher-git-testuseeff-davids-projects-32d42e4c.vercel.app/",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
};
app.use("/", userRouter);
app.use("/", formPostRouter);
app.use("/", adminRouter);
app.use("/", favPostRouter);
app.use("/", paymentRouter);

app.use("/", chatRouter);

app.use(cors(corsOptions));
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
