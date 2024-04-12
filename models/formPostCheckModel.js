import mongoose from "mongoose";
import bcrypt from "bcrypt";

const formShema = new mongoose.Schema({
  postId: { type: String },
  date: { type: String },
  post: {
    value: { type: String },
    title: { type: String },
    person: { type: String },
    price: { type: String },
    km: { type: String },
    fullAddress: { type: String },
    introducing: { type: String },
    slug: { type: String },
    color: { type: String },
    carNumber: { type: String },
    owner: { type: String },
    country: { type: String },
    sit: { type: String },
    activeButton: { type: String },
    accessories: { type: String },
    registry: { type: String },
    numberBox: { type: String },
    status: { type: String },
    cityValueName: { type: String },
    districtValueName: { type: String },
  },
  censorship: { type: Boolean },
});

const FormPostCheck = mongoose.model("FormPostCheck", formShema);

export default FormPostCheck;
