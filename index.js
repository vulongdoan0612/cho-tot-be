import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import userRouter from "./routes/userRoutes.js";
import formPostRouter from "./routes/formPostRoutes.js";
import adminRouter from "./routes/adminCMS.js";
import favPostRouter from "./routes/favPost.js";
import chatRouter from "./routes/chat.js";
import paymentRouter from "./routes/payment.js";
import { WebSocketServer } from "ws";
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

const websocket = http.createServer(app);

const wss = new WebSocketServer({ server: websocket });

app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use(
  "/",
  (req, res, next) => {
    req.wss = wss;
    next();
  },
  userRouter
);
app.use("/", favPostRouter);
app.use("/", paymentRouter);
app.use(
  "/",
  (req, res, next) => {
    req.wss = wss;
    next();
  },
  formPostRouter
);
app.use(
  "/",
  (req, res, next) => {
    req.wss = wss;
    next();
  },
  adminRouter
);
app.use(
  "/",
  (req, res, next) => {
    req.wss = wss;
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
websocket.listen(443, () => {
  console.log("Realtime server is listening on port 8080");
});
