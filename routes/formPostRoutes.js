import express from "express";

import { checkAccessToken } from "../middleware/authMiddleware.js";
import cors from "cors";
import jwt from "jsonwebtoken";

import { initializeApp } from "firebase/app";
import {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytesResumable,
  listAll,
  deleteObject,
} from "firebase/storage";
import multer from "multer";

import FormPostCheck from "../models/formPostCheckModel.js";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";

import config from "../config/firebase.js";
import { WebSocketServer } from "ws";
import { webSocketMessage } from "../middleware/sendWebSocketMessage.js";

const wss = new WebSocketServer({ port: 8083 });

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
        const images = await Promise.all(
          req.files.map(async (file, index) => {
            const id = uuidv4();
            const newFilePath = `images/post/${userId}/${postId}/${id}`;
            const storageRef = ref(storage, newFilePath);
            const metadata = {
              contentType: file.mimetype,
            };

            // Tải lên tệp và nhận về snapshot của nó
            const snapshot = await uploadBytesResumable(
              storageRef,
              file.buffer,
              metadata
            );

            // Lấy URL tải xuống từ snapshot
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Trả về đối tượng chứa id và URL tải xuống
            return { uuid: id, img: downloadURL };
          })
        );
        const formPost = new FormPostCheck({
          userId: userId,
          postId,
          hidden: false,
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
            image: images,
          },
          censorship: null,
        });

        await formPost.save();
        webSocketMessage(wss, "post-form", postId);

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
  "/get-post-check-list-accept",
  checkAccessToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const postCheck = await FormPostCheck.find({
        userId,
        hidden: false,
        censorship: true,
      });
      res.status(200).json({ data: postCheck, status: "SUCCESS" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);
formPostCheckRouter.post(
  "/get-post-check-list-censorship",
  checkAccessToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const postCheck = await FormPostCheck.find({
        userId,
        hidden: false,
        censorship: null,
      });
      res.status(200).json({ data: postCheck, status: "SUCCESS" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);
formPostCheckRouter.post(
  "/get-post-check-list-refuse",
  checkAccessToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const postCheck = await FormPostCheck.find({
        userId,
        hidden: false,
        censorship: false,
      });

      res.status(200).json({ data: postCheck, status: "SUCCESS" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);

formPostCheckRouter.post(
  "/get-post-hidden-list",
  checkAccessToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const postCheck = await FormPostCheck.find({ userId, hidden: true });
      res.status(200).json({ data: postCheck, status: "SUCCESS" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  }
);
formPostCheckRouter.post(
  "/update-post-hidden",
  checkAccessToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { postId } = req.body; // Lấy postId từ body của request

      // Kiểm tra xem có bản ghi FormPostCheck nào có userId và postId khớp và hidden là false hay không
      const postCheck = await FormPostCheck.findOneAndUpdate(
        { userId: userId, postId: postId },
        { hidden: false },
        { new: true }
      );

      // Nếu không tìm thấy bản ghi hoặc không có sự khớp, trả về lỗi
      if (!postCheck) {
        return res.status(404).json({
          message: "Không tìm thấy bài đăng hoặc không có quyền truy cập",
          status: "ERROR",
        });
      }

      // Nếu tìm thấy và cập nhật thành công, trả về dữ liệu cập nhật với mã trạng thái 200
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

        const images = await Promise.all(
          req.files.map(async (file, index) => {
            const id = uuidv4();
            const newFilePath = `images/post/${userId}/${postId}/${id}`;
            const storageRef = ref(storage, newFilePath);
            const metadata = {
              contentType: file.mimetype,
            };

            const snapshot = await uploadBytesResumable(
              storageRef,
              file.buffer,
              metadata
            );

            const downloadURL = await getDownloadURL(snapshot.ref);

            return { uuid: id, img: downloadURL };
          })
        );
        let imageObjects;

        if (typeof image === "string") {
          imageObjects = JSON.parse(image);
        } else if (Array.isArray(image)) {
          imageObjects = image.map((jsonString) => JSON.parse(jsonString));
        }
        if (!Array.isArray(imageObjects)) {
          images.push(imageObjects);
        } else {
          imageObjects.forEach((img) => {
            images.push(img);
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
          image: images,
        };

        const updatedPost = await FormPostCheck.findOneAndUpdate(
          { userId: userId, postId: postId },
          { post: updatedFields },
          { new: true }
        );
        async function deleteNonUuidImages(userId, postId, images) {
          const newFilePath = `images/post/${userId}/${postId}`;
          const storageRef = ref(storage, newFilePath);

          try {
            const listResult = await listAll(storageRef);
            const itemsToDelete = listResult.items.filter((item) => {
              return !images.some((image) => image.uuid === item.name);
            });
            await Promise.all(
              itemsToDelete.map(async (item) => {
                try {
                  await deleteObject(item);
                  console.log(`Đã xóa hình ảnh ${item.name}`);
                } catch (error) {
                  console.error(`Lỗi khi xóa hình ảnh ${item.name}:`, error);
                }
              })
            );

            console.log(
              "Đã xóa hình ảnh không được đặt tên là uuid thành công."
            );
          } catch (error) {
            console.error("Lỗi khi xóa hình ảnh:", error);
          }
        }
        if (!updatedPost) {
          return res.status(404).json({
            message: "Không tìm thấy bài đăng",
            status: "ERROR",
          });
        }
        deleteNonUuidImages(userId, postId, images);

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
formPostCheckRouter.put("/hidden-post", checkAccessToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;
    // Kiểm tra nếu postId không tồn tại
    const existingPost = await FormPostCheck.findOne({ postId: postId });
    if (!existingPost) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bài đăng", status: "ERROR" });
    }
    if (existingPost.userId !== userId) {
      return res.status(403).json({
        message: "Bạn không có quyền chỉnh sửa bài đăng này",
        status: "ERROR",
      });
    }
    // Thêm trường hidden là true vào bản ghi và lưu lại
    existingPost.hidden = true;
    const updatedPost = await existingPost.save();

    res.status(200).json({
      message: "Đã thêm trường hidden là true cho bài đăng",
      status: "SUCCESS",
      updatedPost,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Đã xảy ra lỗi",
      status: "ERROR",
      error: error.message,
    });
  }
});
export default formPostCheckRouter;
