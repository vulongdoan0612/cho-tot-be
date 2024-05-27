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



const port = 5000;

app.use(cors(corsOptions));
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
