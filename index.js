import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import userRouter from "./routes/userRoutes.js";
import formPostRouter from "./routes/formPostRoutes.js";

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
  origin: "http://localhost:3000/",
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  credentials: true,
  allowedHeaders: ["Content-type"],
};
app.use("/", userRouter);
app.use("/", formPostRouter);

const port = 5000;

app.use(cors(corsOptions));
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
