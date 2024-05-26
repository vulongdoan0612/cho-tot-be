import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  userId: { type: String },
  postId: { type: String },
  amount: { type: Object },
  time: { type: String },
  idCheck: { type: String },
});

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
