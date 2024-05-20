import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  dateJoin: { type: Date, default: null },
  avatar: { type: String, default: null },
  banner: { type: String, default: null },
  address: {
    cityValue: { type: String },
    districtValue: { type: String },
    wardValue: { type: String },

    city: { type: String },
    district: { type: String },
    ward: { type: String },
    detailAddress: {
      type: String,
    },
    fullAddress: {
      type: String,
    },
  },
  announceChat: { type: Boolean, default: false },
  rememberName: { type: String },
  introduction: { type: String },
  identifyCard: {
    CMND: { type: String },
    date: { type: String },
    location: { type: String },
    fullCMND: { type: String },
  },
  selling: { type: String },
  selled: { type: String },
  faxNumber: { type: String },
  favouriteList: { type: Array, default: undefined },
  sex: { type: String },
  birthdate: { type: String },
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
