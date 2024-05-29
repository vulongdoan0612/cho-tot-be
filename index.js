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
import { WebSocket, WebSocketServer } from "ws";
import http from "http";

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

const port8085 = http.createServer(app);
// Tạo HTTP server từ express app
const wss8085 = new WebSocketServer({ noServer: true });
port8085.on("upgrade", (request, socket, head) => {
  const pathname = request.url;
  console.log(request);
  if (pathname === "/chat") {
    wss8085.handleUpgrade(request, socket, head, (ws) => {
      wss8085.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});
wss8085.on("connection", (ws, request) => {
  ws.on("message", (message) => {
    console.log(`Received message: ${message}`);
    // Broadcast the message to all clients
    wss8085.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.send("Welcome to the WebSocket server!");
});
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
// const corsOptions = {
//   origin: "https://cho-tot-fresher-git-testuseeff-davids-projects-32d42e4c.vercel.app/",
//   methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
//   credentials: true,
// };
app.use("/", userRouter);
app.use("/", formPostRouter);
app.use("/", adminRouter);
app.use("/", favPostRouter);
app.use("/", paymentRouter);
// app.use("/", chatRouter);

app.use(
  "/",
  (req, res, next) => {
    req.wss = wss8085;
    next();
  },
  chatRouter
);

const port = 5000;
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
// app.use(cors(corsOptions));
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
port8085.listen(8080, () => {
  console.log("Realtime server is listening on port 8080");
});
