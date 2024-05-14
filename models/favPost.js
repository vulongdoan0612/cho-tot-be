import mongoose from "mongoose";

const formShema = new mongoose.Schema({
  userId: { type: String },
  postFavList: { type: Object },
});

const FavPost = mongoose.model("FavPost", formShema);

export default FavPost;
