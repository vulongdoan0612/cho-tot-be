import express from "express";

import { checkAccessToken } from "../middleware/authMiddleware.js";
import cors from "cors";
import jwt from "jsonwebtoken";

import { initializeApp } from "firebase/app";
import { getStorage, ref, getDownloadURL, uploadBytesResumable, listAll, deleteObject } from "firebase/storage";
import multer from "multer";

import FormPostCheck from "../models/formPostCheckModel.js";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";

import config from "../config/firebase.js";
import { WebSocketServer } from "ws";
import { webSocketMessage } from "../middleware/sendWebSocketMessage.js";
import convertToSlug from "../utils/convertToSlug.js";
import User from "../models/userModel.js";

const wss = new WebSocketServer({ port: 8083 });

initializeApp(config.firebaseConfig);
const storage = getStorage();
const upload = multer({ storage: multer.memoryStorage() });
const formPostCheckRouter = express.Router();
formPostCheckRouter.use(cors());

formPostCheckRouter.post("/post-form-sell-check", upload.array("image", 8), checkAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId); // Truy xuất thông tin của user từ model User

    if (!user) {
      return res.status(404).json({ message: "User not found", status: "ERROR" });
    }
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
      wardValueName,

      cityValue,
      districtValue,
      wardValue,
      detailAddress,
    } = req.body;
    if (req.files) {
      const postIdRef = ref(storage, `images/post/${userId}/${postId}`);
      const postIdSnapshot = await getDownloadURL(postIdRef).catch(() => null);

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
          const snapshot = await uploadBytesResumable(storageRef, file.buffer, metadata);

          // Lấy URL tải xuống từ snapshot
          const downloadURL = await getDownloadURL(snapshot.ref);

          // Trả về đối tượng chứa id và URL tải xuống
          return { uuid: id, img: downloadURL };
        })
      );

      const formPost = new FormPostCheck({
        userId: userId,
        userInfo: {
          // selling: user.selling,
          // selled: user.selled,
          fullName: user.fullname,
          districtValueName: user.address.district,
          cityValueName: user.address.city,
          wardValueName: user.address.ward,
          phone: user.phone,
        },
        postId,
        hidden: false,
        date: moment().format("DD-MM-YYYY"),
        post: {
          value,
          dateCar,
          price,
          color,
          wardValueName,

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
          cityValueName,
          districtValueName,
          slug: `mua-ban-oto-${convertToSlug(districtValueName)}-${convertToSlug(cityValueName)}`,
          image: images,
        },
        censorship: null,
      });

      await formPost.save();
      webSocketMessage(wss, "post-form", postId);

      res.status(201).json({
        message: "Chúc mừng bạn đã đăng tin thành công, vui lòng chờ kiểm duyệt nội dung.",
        status: "SUCCESS",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
formPostCheckRouter.post("/get-post-check", checkAccessToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const postCheck = await FormPostCheck.findOne({ postId });
    res.status(200).json({ postCheck });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

formPostCheckRouter.post("/get-post-check-list-accept", checkAccessToken, async (req, res) => {
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
});
formPostCheckRouter.post("/get-post-check-list-censorship", checkAccessToken, async (req, res) => {
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
});
formPostCheckRouter.post("/get-posts", async (req, res) => {
  try {
    const { pageSize, currentPage, price, form, sit, fuel, numberBox, city, district } = req.query;
    let filter = {
      hidden: false,
      censorship: true,
    };
    if (city !== "undefined") {
      if (city === "tp-ho-chi-minh") {
        filter["post.cityValueName"] = { $eq: "Thành phố Hồ Chí Minh" };
      } else if (city === "ha-noi") {
        filter["post.cityValueName"] = { $eq: "Thành phố Hà Nội" };
      } else if (city === "da-nang") {
        filter["post.cityValueName"] = { $eq: "Thành phố Đà Nẵng" };
      } else if (city === "can-tho") {
        filter["post.cityValueName"] = { $eq: "Thành phố Cần Thơ" };
      } else if (city === "binh-duong") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Bình Dương" };
      } else if (city === "ba-ria-vt") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Bà Rịa - Vũng Tàu" };
      } else if (city === "bac-giang") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Bắc Giang" };
      } else if (city === "bac-kan") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Bắc Kạn" };
      } else if (city === "bac-lieu") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Bạc Liêu" };
      } else if (city === "bac-ninh") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Bắc Ninh" };
      } else if (city === "ben-tre") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Bến Tre" };
      } else if (city === "binh-dinh") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Bình Định" };
      } else if (city === "binh-phuoc") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Bình Phước" };
      } else if (city === "binh-thuan") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Bình Thuận" };
      } else if (city === "ca-mau") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Cà Mau" };
      } else if (city === "cao-bang") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Cao Bằng" };
      } else if (city === "dak-lak") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Đắk Lắk" };
      } else if (city === "dak-nong") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Đắk Nông" };
      } else if (city === "dien-bien") {
        filter["post.cityValueName"] = { $eq: "Tỉnh Điện Biên" };
      } else {
        filter["post.cityValueName"] = parseInt(city);
      }
    }
    if (district !== "undefined") {
      filter["post.districtValueName"] = { $regex: new RegExp(district, "i") };
    }
    if (fuel !== "undefined") {
      if (fuel === "xang") {
        filter["post.activeButton"] = { $eq: "Xăng" };
      } else if (fuel === "dau") {
        filter["post.activeButton"] = { $eq: "Dầu" };
      } else if (fuel === "hybrid") {
        filter["post.activeButton"] = { $eq: "Động cơ Hybrid" };
      } else if (fuel === "dien") {
        filter["post.activeButton"] = { $eq: "Điện" };
      } else {
        filter["post.activeButton"] = parseInt(fuel);
      }
    }
    if (numberBox !== "undefined") {
      if (numberBox === "tu-dong") {
        filter["post.numberBox"] = { $eq: "Tự động" };
      } else if (numberBox === "so-san") {
        filter["post.numberBox"] = { $eq: "Số sàn" };
      } else if (numberBox === "ban-tu-dong") {
        filter["post.numberBox"] = { $eq: "Bán tự động" };
      } else {
        filter["post.numberBox"] = parseInt(numberBox);
      }
    }
    if (sit !== "undefined") {
      if (sit === "2") {
        filter["post.sit"] = { $eq: "2" };
      } else if (sit === "4") {
        filter["post.sit"] = { $eq: "4" };
      } else if (sit === "5") {
        filter["post.sit"] = { $eq: "5" };
      } else if (sit === "6") {
        filter["post.sit"] = { $eq: "6" };
      } else if (sit === "7") {
        filter["post.sit"] = { $eq: "7" };
      } else if (sit === "8") {
        filter["post.sit"] = { $eq: "8" };
      } else if (sit === "9") {
        filter["post.sit"] = { $eq: "9" };
      } else if (sit === "10") {
        filter["post.sit"] = { $eq: "10" };
      } else if (sit === "12") {
        filter["post.sit"] = { $eq: "12" };
      } else if (sit === "14") {
        filter["post.sit"] = { $eq: "14" };
      } else if (sit === "16") {
        filter["post.sit"] = { $eq: "16" };
      } else {
        filter["post.sit"] = parseInt(sit);
      }
    }
    if (form !== "undefined") {
      if (form === "sudan") {
        filter["post.form"] = { $eq: "Sudan" };
      } else if (form === "suv/cross-over") {
        filter["post.form"] = { $eq: "SUV/Cross over" };
      } else if (form === "hatchback") {
        filter["post.form"] = { $eq: "Hatchback" };
      } else if (form === "pickup") {
        filter["post.form"] = { $eq: "Pick-up (bán tải)" };
      } else if (form === "minivan") {
        filter["post.form"] = { $eq: "Minivan (MPV)" };
      } else if (form === "van") {
        filter["post.form"] = { $eq: "Van" };
      } else if (form === "couple-2-cua") {
        filter["post.form"] = { $eq: "Couple 2 cửa" };
      } else if (form === "mui-tran") {
        filter["post.form"] = { $eq: "Mui trần" };
      } else {
        filter["post.form"] = parseInt(form);
      }
    }
    const match = price.match(/(min|max)(\d+)/);

    console.log(match, "test");
    if (price !== "undefined") {
      if (price === "un200tr") {
        filter["post.price"] = { $lt: 200000000 };
      } else if (price === "200tr-300tr") {
        filter["post.price"] = { $gte: 200000000, $lte: 300000000 };
      } else if (price === "300tr-400tr") {
        filter["post.price"] = { $gte: 300000000, $lte: 400000000 };
      } else if (price === "400tr-500tr") {
        filter["post.price"] = { $gte: 400000000, $lte: 500000000 };
      } else if (price === "500tr-600tr") {
        filter["post.price"] = { $gte: 500000000, $lte: 600000000 };
      } else if (price === "600tr-700tr") {
        filter["post.price"] = { $gte: 600000000, $lte: 700000000 };
      } else if (price === "700tr-800tr") {
        filter["post.price"] = { $gte: 700000000, $lte: 800000000 };
      } else if (price === "800tr-1t") {
        filter["post.price"] = { $gte: 800000000, $lte: 1000000000 };
      } else if (price === "1t-2t") {
        filter["post.price"] = { $gte: 1000000000, $lte: 2000000000 };
      } else if (price === "up2t") {
        filter["post.price"] = { $gte: 2000000000 };
      } else if (match[1] === "max") {
        filter["post.price"] = { $lt: match[2] };

        // Phân tích giá trị price thành hai phần, số thứ nhất và số thứ hai
      } else if (match[1] === "min") {
        filter["post.price"] = { $gte: match[2] };
      } else {
        if (!isNaN(lowerPrice) && !isNaN(upperPrice)) {
          filter["post.price"] = { $gte: lowerPrice, $lte: upperPrice };
        } else {
          // Xử lý nếu giá trị không hợp lệ
        }
      }
      // const [lowerPrice, upperPrice] = price.split("-").map((item) => parseInt(item));
      // // Kiểm tra xem cả hai phần đã được chuyển đổi thành số chưa
    }
    const skipCount = (currentPage - 1) * pageSize;
    const totalRecords = await FormPostCheck.countDocuments(filter);
    const posts = await FormPostCheck.find(filter).skip(skipCount).limit(pageSize);
    res.status(200).json({ data: posts, status: "SUCCESS", total: totalRecords });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
formPostCheckRouter.post("/get-post-check-list-refuse", checkAccessToken, async (req, res) => {
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
});

formPostCheckRouter.post("/get-post-hidden-list", checkAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postCheck = await FormPostCheck.find({ userId, hidden: true });
    res.status(200).json({ data: postCheck, status: "SUCCESS" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
formPostCheckRouter.post("/update-post-hidden", checkAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { postId } = req.body; // Lấy postId từ body của request

    // Kiểm tra xem có bản ghi FormPostCheck nào có userId và postId khớp và hidden là false hay không
    const postCheck = await FormPostCheck.findOneAndUpdate({ userId: userId, postId: postId }, { hidden: false }, { new: true });

    // Nếu không tìm thấy bản ghi hoặc không có sự khớp, trả về lỗi
    if (!postCheck) {
      return res.status(404).json({
        message: "Không tìm thấy bài đăng hoặc không có quyền truy cập",
        status: "ERROR",
      });
    }
    const userPosts = await FormPostCheck.find({
      userId: postCheck.userId,
    });

    // Tính số lượng bài viết đã chấp nhận (censorship = true) và ẩn đi (hidden = true)
    const acceptedPostsCount = userPosts.filter((post) => post.censorship === true && post.hidden === false).length;
    const hiddenPostsCount = userPosts.filter((post) => post.hidden === true && post.censorship === true).length;
    // Cập nhật thông tin của các bài viết của user với trường selling
    await Promise.all(
      userPosts.map(async (post) => {
        post.userInfo.selling = acceptedPostsCount;
        post.userInfo.selled = hiddenPostsCount;
        await post.save();
      })
    );

    // Nếu tìm thấy và cập nhật thành công, trả về dữ liệu cập nhật với mã trạng thái 200
    res.status(200).json({ data: postCheck, status: "SUCCESS" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
formPostCheckRouter.put("/edit-post-form-sell-check", upload.array("image", 9), checkAccessToken, async (req, res) => {
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
      wardValueName,
      cityValue,
      districtValue,
      wardValue,
      detailAddress,
    } = req.body;
    if (req.files) {
      const postIdRef = ref(storage, `images/post/${userId}/${postId}`);
      const postIdSnapshot = await getDownloadURL(postIdRef).catch(() => null);

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

          const snapshot = await uploadBytesResumable(storageRef, file.buffer, metadata);

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
        districtValueName,
        cityValueName,
        wardValueName,
        activeButton,
        accessories,
        registry,
        numberBox,
        status,
        title,
        person,
        cityValueName,
        districtValueName,
        fullAddress,
        cityValue,
        districtValue,
        wardValue,
        introducing,
        detailAddress,
        slug: `mua-ban-oto-${convertToSlug(districtValueName)}-${convertToSlug(cityValueName)}`,
        image: images,
      };

      const updatedPost = await FormPostCheck.findOneAndUpdate({ userId: userId, postId: postId }, { post: updatedFields }, { new: true });
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

          console.log("Đã xóa hình ảnh không được đặt tên là uuid thành công.");
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
      webSocketMessage(wss, "post-form-edit", postId);

      res.status(200).json({
        message: "Cập nhật bài đăng thành công",
        status: "SUCCESS",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
formPostCheckRouter.put("/hidden-post", checkAccessToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;
    // Kiểm tra nếu postId không tồn tại
    const existingPost = await FormPostCheck.findOne({ postId: postId });
    if (!existingPost) {
      return res.status(404).json({ message: "Không tìm thấy bài đăng", status: "ERROR" });
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
    const userPosts = await FormPostCheck.find({
      userId: updatedPost.userId,
    });

    // Tính số lượng bài viết đã chấp nhận (censorship = true) và ẩn đi (hidden = true)
    const acceptedPostsCount = userPosts.filter((post) => post.censorship === true && post.hidden === false).length;
    const hiddenPostsCount = userPosts.filter((post) => post.hidden === true && post.censorship === true).length;

    // Cập nhật thông tin của các bài viết của user với trường selling
    await Promise.all(
      userPosts.map(async (post) => {
        post.userInfo.selling = acceptedPostsCount;
        post.userInfo.selled = hiddenPostsCount;
        await post.save();
      })
    );

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
