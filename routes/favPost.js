import express from "express";
import { checkAccessToken } from "../middleware/authMiddleware.js";
import cors from "cors";
import FavPost from "../models/favPost.js";
import FormPostCheck from "../models/formPostCheckModel.js";

const favPostRouter = express.Router();
favPostRouter.use(cors());

favPostRouter.post("/add-fav-post", checkAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.body.postId;
    let favPost = await FavPost.findOne({ userId });

    if (!favPost) {
      favPost = new FavPost({
        userId: userId,
        postFavList: [{ postId: postId }],
      });
      await favPost.save();
      return res.status(201).json({ message: "Favourite post added", status: "SUCCESS" });
    }
    const postIndex = favPost.postFavList.findIndex((item) => item.postId === postId);
    if (postIndex !== -1) {
      return res.status(400).json({ message: "Post is already in favourite list", status: "ERROR" });
    }
    await FavPost.findOneAndUpdate({ userId }, { $addToSet: { postFavList: { postId: postId } } }, { new: true, upsert: true });

    res.status(201).json({ message: "Favourite post added", status: "SUCCESS" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

favPostRouter.post("/check-fav-post", checkAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { postId } = req.body;

    const favPost = await FavPost.findOne({ userId });

    if (!favPost) {
      return res.status(200).json({ status: false });
    }

    const postIndex = favPost.postFavList.findIndex((item) => item.postId === postId);

    if (postIndex === -1) {
      return res.status(200).json({ status: false });
    }

    res.status(200).json({ status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
favPostRouter.post("/remove-fav-post", checkAccessToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;
    let favPost = await FavPost.findOne({ userId });

    if (!favPost) {
      return res.status(404).json({ message: "User's favourite post not found", status: "ERROR" });
    }

    const postExists = favPost.postFavList.some((item) => item.postId === postId);

    if (!postExists) {
      return res.status(404).json({ message: "Post not found in user's favourite post", status: "ERROR" });
    }

    if (favPost.postFavList.length === 1) {
      await FavPost.deleteOne({ userId });
    } else {
      favPost.postFavList = favPost.postFavList.filter((item) => item.postId !== postId);
      await favPost.save();
    }

    res.status(200).json({ message: "Post removed from favourite post successfully", status: "SUCCESS" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
favPostRouter.post("/get-fav-post", checkAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const favPost = await FavPost.findOne({ userId });
    if (!favPost) {
      return res.status(200).json({ favouritePosts: [], status: "SUCCESS" });
    }

    const postIds = favPost.postFavList.map((item) => item.postId);

    const posts = await FormPostCheck.find({ postId: { $in: postIds }, censorship: true });

    res.status(200).json({ favouritePosts: posts, status: "SUCCESS" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
favPostRouter.post("/get-fav-post-main", checkAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const favPost = await FavPost.findOne({ userId });

    res.status(200).json({ favPost: favPost, status: "SUCCESS" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
export default favPostRouter;
