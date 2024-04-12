import express from "express";

import { checkAccessToken } from "../middleware/authMiddleware.js";
import cors from "cors";
import FormPostCheck from "../models/formPostCheckModel.js";
import moment from "moment";

const formPostCheckRouter = express.Router();
formPostCheckRouter.use(cors());

formPostCheckRouter.post(
  "/post-form-sell-check",
  checkAccessToken,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const {
        postId,
        km,
        price,
        value,
        color,
        carNumber,
        owner,
        country,
        sit,
        activeButton,
        accessories,
        registry,
        numberBox,
        status,
        title,
        person,
        fullAddress,
        introducing,
        districtValueName,
        cityValueName,
      } = req.body;

      const formPost = new FormPostCheck({
        userId: userId,
        postId,
        date: moment().format("DD-MM-YYYY"),
        post: {
          value,
          price,
          color,
          km,
          carNumber,
          owner,
          country,
          sit,
          activeButton,
          accessories,
          registry,
          numberBox,
          status,
          title,
          person,
          fullAddress,
          introducing,
          slug: `mua-ban-oto-${districtValueName}-${cityValueName}`,
        },
        censorship: false,
      });

      await formPost.save();

      res.status(201).json({
        message:
          "Chúc mừng bạn đã đăng tin thành công, vui lòng chờ kiểm duyệt nội dung.",
        status: "SUCCESS",
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);
formPostCheckRouter.post(
  "/get-post-check",
  checkAccessToken,
  async (req, res) => {
    try {
      const { postId } = req.body;
      console.log(postId, "test");
      const postCheck = await FormPostCheck.findOne({ postId });
      console.log(postCheck, postId);
      res.status(200).json({ postCheck });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);
export default formPostCheckRouter;
