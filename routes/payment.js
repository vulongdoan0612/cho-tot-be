import express from "express";
import cors from "cors";
import { checkAccessToken } from "../middleware/authMiddleware.js";
import dotenv from "dotenv";
import Payment from "../models/payment.js";
import FormPostCheck from "../models/formPostCheckModel.js";

const paymentRouter = express.Router();
paymentRouter.use(cors());
dotenv.config();

paymentRouter.get("/config", checkAccessToken, async (req, res) => {
  try {
    res.status(200).json({ status: "ok", clientId: process.env.CLIENT_ID });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
paymentRouter.post("/payment-info", checkAccessToken, async (req, res) => {
  try {
    const { postId, amount, time, idCheck } = req.body;
    const userId = req.user.id;
    const newPayment = new Payment({
      userId,
      postId,
      amount,
      time,
      idCheck,
    });
    await newPayment.save();
    await FormPostCheck.findOneAndUpdate(
      {
        postId: postId,
        censorship: true,
        hidden: false,
      },
      {
        prioritize: amount,
      },
      {
        new: true,
      }
    );
    res.status(200).json({ status: "SUCCESS", newPayment: newPayment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
paymentRouter.post("/history", checkAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const payments = await Payment.find({ userId });
    const postIds = payments.map((payment) => payment.postId);
    const formPostChecks = await FormPostCheck.find({
      postId: { $in: postIds },
      hidden: false,
      censorship: true,
    }).select(
      "post.image post.title post.dateCar post.activeButton post.numberBox post.price post.fullAddress postId userInfo post.districtValueName post.km date"
    );
    const paymentsWithFormPostChecks = payments.map((payment) => {
      const formPostCheck = formPostChecks.find((fp) => fp.postId === payment.postId);
      return {
        ...payment._doc,
        formPostCheck,
      };
    });

    res.status(200).json({ status: "SUCCESS", payments: paymentsWithFormPostChecks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
export default paymentRouter;
