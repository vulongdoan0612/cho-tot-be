import express from "express";

import { checkAccessToken } from "../middleware/authMiddleware.js";
import cors from "cors";
import { initializeApp } from "firebase/app";
import {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytesResumable,
  listAll,
} from "firebase/storage";
import multer from "multer";

import FormPostCheck from "../models/formPostCheckModel.js";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";

import config from "../config/firebase.js";
initializeApp(config.firebaseConfig);
const storage = getStorage();
const upload = multer({ storage: multer.memoryStorage() });
const formPostCheckRouter = express.Router();
formPostCheckRouter.use(cors());

formPostCheckRouter.post(
  "/post-form-sell-check",
  upload.array("image", 8),
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
        model,
        dateCar,
        accessories,
        registry,
        numberBox,
        status,
        title,
        person,
        fullAddress,
        form,
        introducing,
        districtValueName,
        cityValueName,
        cityValue,
        districtValue,
        wardValue,
        detailAddress,
      } = req.body;
      if (req.files) {
        const postIdRef = ref(storage, `images/post/${userId}/${postId}`);
        const postIdSnapshot = await getDownloadURL(postIdRef).catch(
          () => null
        );

        if (!postIdSnapshot) {
          await uploadBytesResumable(postIdRef, new Uint8Array());
        }
        console.log(req.files);
        const snapshots = await Promise.all(
          req.files.map(async (file, index) => {
            const id = uuidv4();

            const newFilePath = `images/post/${userId}/${postId}/${id}`;
            const storageRef = ref(storage, newFilePath);
            const metadata = {
              contentType: file.mimetype,
            };

            return await uploadBytesResumable(
              storageRef,
              file.buffer,
              metadata
            );
          })
        );

        const downloadURLs = await Promise.all(
          snapshots.map((snapshot) => getDownloadURL(snapshot.ref))
        );

        const formPost = new FormPostCheck({
          userId: userId,
          postId,
          date: moment().format("DD-MM-YYYY"),
          post: {
            value,
            dateCar,
            price,
            color,
            km,
            model,
            carNumber,
            owner,
            form,
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
            cityValue,
            districtValue,
            wardValue,
            introducing,
            detailAddress,
            slug: `mua-ban-oto-${districtValueName}-${cityValueName}`,
            image: downloadURLs,
          },
          censorship: false,
        });

        await formPost.save();

        res.status(201).json({
          message:
            "Chúc mừng bạn đã đăng tin thành công, vui lòng chờ kiểm duyệt nội dung.",
          status: "SUCCESS",
        });
      }
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
      const postCheck = await FormPostCheck.findOne({ postId });
      res.status(200).json({ postCheck });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);
formPostCheckRouter.post(
  "/get-post-check-list",
  checkAccessToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const postCheck = await FormPostCheck.find({ userId });
      res.status(200).json({ data: postCheck, status: "SUCCESS" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);
formPostCheckRouter.put(
  "/edit-post-form-sell-check",
  upload.array("image", 9),
  checkAccessToken,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const {
        image,
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
        model,
        dateCar,
        accessories,
        registry,
        numberBox,
        status,
        title,
        person,
        fullAddress,
        form,
        introducing,
        districtValueName,
        cityValueName,
        cityValue,
        districtValue,
        wardValue,
        detailAddress,
      } = req.body;
      if (req.files) {
        const postIdRef = ref(storage, `images/post/${userId}/${postId}`);
        const postIdSnapshot = await getDownloadURL(postIdRef).catch(
          () => null
        );

        if (!postIdSnapshot) {
          await uploadBytesResumable(postIdRef, new Uint8Array());
        }

        const snapshots2 = await Promise.all(
          req.files.map(async (file, index) => {
            const id = uuidv4();
            console.log(id);
            const newFilePath = `images/post/${userId}/${postId}/${id}`;
            const newFileRef = ref(storage, newFilePath);

            const metadata = {
              contentType: file.mimetype,
            };
            return await uploadBytesResumable(
              newFileRef,
              file.buffer,
              metadata
            );
          })
        );

        const downloadURLs = await Promise.all(
          snapshots2.map((snapshot) => getDownloadURL(snapshot.ref))
        );
        console.log(typeof image === "string", image);
        if (typeof image === "string") {
          // Nếu image là một chuỗi duy nhất
          downloadURLs.push(image);
        } else if (Array.isArray(image)) {
          // Nếu image là một mảng
          image.forEach((url) => {
            downloadURLs.push(url);
          });
        }

        const updatedFields = {
          value,
          dateCar,
          price,
          color,
          km,
          model,
          carNumber,
          owner,
          form,
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
          cityValue,
          districtValue,
          wardValue,
          introducing,
          detailAddress,
          slug: `mua-ban-oto-${districtValueName}-${cityValueName}`,
          image: downloadURLs,
        };
        const updatedPost = await FormPostCheck.findOneAndUpdate(
          { userId: userId, postId: postId },
          { post: updatedFields },
          { new: true }
        );

        if (!updatedPost) {
          return res.status(404).json({
            message: "Không tìm thấy bài đăng",
            status: "ERROR",
          });
        }

        res.status(200).json({
          message: "Cập nhật bài đăng thành công",
          status: "SUCCESS",
        });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default formPostCheckRouter;
