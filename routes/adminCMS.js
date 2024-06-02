import express from "express";
import User from "../models/userModel.js";
import cors from "cors";
import Admin from "../models/adminCMS.js";
import bcrypt from "bcrypt";
import { checkAccessToken } from "../middleware/authMiddleware.js";
import jwt from "jsonwebtoken";
import FormPostCheck from "../models/formPostCheckModel.js";
import { webSocketMessage } from "../middleware/sendWebSocketMessage.js";
import FavPost from "../models/favPost.js";

const adminRouter = express.Router();
adminRouter.use(cors());

adminRouter.get("/get-users-cms", checkAccessToken, async (req, res) => {
  try {
    const admin = req.user;
    if (admin.id === "66213dc8577a7e09c3ec5b2e") {
      const users = await User.find({}, "-password");
      res.status(200).json({ data: users, status: "SUCCESS" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
adminRouter.delete("/delete-user", checkAccessToken, async (req, res) => {
  try {
    const { _id } = req.body;
    const admin = req.user;
    if (admin.id !== "66213dc8577a7e09c3ec5b2e") {
      return res.status(403).json({ message: "Unauthorized", status: "ERROR" });
    }
    if (!_id) {
      return res.status(400).json({ message: "Invalid userId", status: "ERROR" });
    }

    const deletedUser = await User.findOneAndDelete({ _id: _id });

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found", status: "ERROR" });
    }
    await FormPostCheck.deleteMany({ userId: _id });
    const wss = req.wss;

    webSocketMessage(wss, "delete-user", _id);

    res.status(200).json({ message: "User deleted successfully", status: "SUCCESS" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: error.message });
  }
});
adminRouter.post("/accept-censorship", checkAccessToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const admin = req.user;
    if (admin.id !== "66213dc8577a7e09c3ec5b2e") {
      return res.status(403).json({ message: "Unauthorized", status: "ERROR" });
    }

    const updatedPost = await FormPostCheck.findOneAndUpdate({ postId }, { censorship: true }, { new: true });
    if (!updatedPost) {
      return res.status(404).json({ message: "Post not found", status: "ERROR" });
    }

    const user = await User.findById(updatedPost.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found", status: "ERROR" });
    }
    const userPosts = await FormPostCheck.find({
      userId: updatedPost.userId,
    });

    const acceptedPostsCount = userPosts.filter((post) => post.censorship === true && post.hidden === false).length;
    const hiddenPostsCount = userPosts.filter((post) => post.hidden === true && post.censorship === true).length;

    await FormPostCheck.updateMany(
      { userId: updatedPost.userId },
      {
        $set: {
          "userInfo.selling": acceptedPostsCount,
          "userInfo.selled": hiddenPostsCount,
        },
      }
    );
    const wss = req.wss;

    webSocketMessage(wss, "accept", updatedPost.postId, updatedPost.userId);

    res.status(200).json({
      message: "Censorship updated successfully",
      status: "SUCCESS",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

adminRouter.post("/refuse-censorship", checkAccessToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const admin = req.user;
    if (admin.id !== "66213dc8577a7e09c3ec5b2e") {
      return res.status(403).json({ message: "Unauthorized", status: "ERROR" });
    }

    const updatedPost = await FormPostCheck.findOneAndUpdate({ postId }, { censorship: false }, { new: true });

    if (!updatedPost) {
      return res.status(404).json({ message: "Post not found", status: "ERROR" });
    }
    const user = await User.findById(updatedPost.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found", status: "ERROR" });
    }

    const userPosts = await FormPostCheck.find({
      userId: updatedPost.userId,
    });

    const acceptedPostsCount = userPosts.filter((post) => post.censorship === true && post.hidden === false).length;
    const hiddenPostsCount = userPosts.filter((post) => post.hidden === true && post.censorship === true).length;

    await FormPostCheck.updateMany(
      { userId: updatedPost.userId },
      {
        $set: {
          "userInfo.selling": acceptedPostsCount,
          "userInfo.selled": hiddenPostsCount,
        },
      }
    );
    await FavPost.updateMany({}, { $pull: { postFavList: { postId } } });
    const wss = req.wss;

    webSocketMessage(wss, "refuse", updatedPost.postId, updatedPost.userId);
    res.status(200).json({
      message: "Censorship updated successfully",
      status: "SUCCESS",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
adminRouter.delete("/delete-post", checkAccessToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const deletedPost = await FormPostCheck.findOneAndDelete({ postId: postId });

    if (!deletedPost) {
      return res.status(404).json({ message: "Post not found", status: "ERROR" });
    }
    const userPosts = await FormPostCheck.find({
      userId: deletedPost.userId,
    });
    const user = await User.findById(deletedPost.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found", status: "ERROR" });
    }

    const acceptedPostsCount = userPosts.filter((post) => post.censorship === true && post.hidden === false).length;
    const hiddenPostsCount = userPosts.filter((post) => post.hidden === true && post.censorship === true).length;
    await FavPost.updateMany({}, { $pull: { postFavList: { postId } } });
    await FormPostCheck.updateMany(
      { userId: userPosts.userId },
      {
        $set: {
          "userInfo.selling": acceptedPostsCount,
          "userInfo.selled": hiddenPostsCount,
        },
      }
    );
    const wss = req.wss;

    webSocketMessage(wss, "delete", deletedPost.postId, userPosts.userId);

    res.status(200).json({ message: "Post deleted successfully", status: "SUCCESS" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
adminRouter.get("/get-posts-cms", checkAccessToken, async (req, res) => {
  try {
    const admin = req.user;
    if (admin.id === "66213dc8577a7e09c3ec5b2e") {
      const posts = await FormPostCheck.find({});
      res.status(200).json({ data: posts, status: "SUCCESS" });
    } else {
      res.status(403).json({ message: "Unauthorized", status: "ERROR" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
adminRouter.post("/login-cms", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await Admin.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: "Tài khoản không tìm thấy.", status: "NOT_FOUND" });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid) {
      const token = jwt.sign({ id: user._id }, "VinalinkGroup!2020");
      res.status(200).json({ token, message: "Đăng nhập thành công.", status: "SUCCESS" });
    } else {
      res.status(200).json({
        message: "Sai mật khẩu hoặc số điện thoại.",
        status: "UNSUCCESS",
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
adminRouter.put("/change-password-cms", checkAccessToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const adminId = req.user.id;
    const admin = await Admin.findById(adminId);

    const isPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isPasswordValid) {
      return res.status(200).json({ message: "Mật khẩu hiện tại không đúng." });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    admin.password = hashedNewPassword;
    await admin.save();

    res.status(200).json({
      message: "Mật khẩu đã được thay đổi thành công.",
      success: true,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

adminRouter.get("/get-profile-cms", checkAccessToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findById(adminId).select("-password");
    res.status(200).json({ admin: admin });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
export default adminRouter;
