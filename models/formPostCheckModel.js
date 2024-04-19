import mongoose from "mongoose";

const formShema = new mongoose.Schema({
  postId: { type: String },
  date: { type: String },
  expired: { type: String },
  userId: { type: String },
  hidden: { type: Boolean },
  post: {
    image: [{ uuid: { type: String }, img: { type: String } }],
    value: { type: String },
    title: { type: String },
    dateCar: { type: String },
    person: { type: String },
    form: { type: String },
    price: { type: String },
    km: { type: String },
    fullAddress: { type: String },
    introducing: { type: String },
    slug: { type: String },
    color: { type: String },
    model: { type: String },
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
    cityValue: { type: String },
    districtValue: { type: String },
    wardValue: { type: String },
    detailAddress: { type: String },
  },
  censorship: { type: Boolean || null },
});

const FormPostCheck = mongoose.model("FormPostCheck", formShema);

export default FormPostCheck;
