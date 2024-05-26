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
import { colorsCar, countriesCar, postCar, statusCar } from "../mock/_mock.js";
import { viewPost } from "../middleware/viewPost.js";

const wss = new WebSocketServer({ port: 8083 });

initializeApp(config.firebaseConfig);
const storage = getStorage();
const upload = multer({ storage: multer.memoryStorage() });
const formPostCheckRouter = express.Router();
formPostCheckRouter.use(cors());

formPostCheckRouter.post("/post-form-sell-check", upload.array("image", 20), checkAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

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

          const snapshot = await uploadBytesResumable(storageRef, file.buffer, metadata);

          const downloadURL = await getDownloadURL(snapshot.ref);

          return { uuid: id, img: downloadURL };
        })
      );
      const formPost = new FormPostCheck({
        userId: userId,
        userInfo: {
          avatar: user.avatar,
          fullName: user.fullname,
          districtValueName: user.address.district,
          cityValueName: user.address.city,
          wardValueName: user.address.ward,
          phone: user.phone,
        },
        postId,
        hidden: false,
        date: new Date(),
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
formPostCheckRouter.post("/get-post-service", checkAccessToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const post = await FormPostCheck.findOne({ postId }).select(
      "userId userInfo.fullName date post.image post.title post.price prioritize postId"
    );
    res.status(200).json({ post });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
formPostCheckRouter.post("/get-post", async (req, res) => {
  try {
    const { postId } = req.body;
    const post = await FormPostCheck.findOne({ postId: postId, censorship: true, hidden: false });
    if (post === null) {
      return res.status(200).json({ status: "404" });
    }
    const user = await User.findById(post.userId);
    if (user) {
      post.userInfo.avatar = user.avatar || "images/empty-avatar.jpg";
    }
    await FormPostCheck.findOneAndUpdate({ postId: postId, censorship: true, hidden: false }, { $inc: { view: 1 } });

    const wardValueName = post.post.wardValueName;
    const districtValueName = post.post.districtValueName;

    const relatedPosts = await FormPostCheck.aggregate([
      {
        $match: {
          postId: { $ne: postId },
          "post.wardValueName": wardValueName,
          "post.districtValueName": districtValueName,
        },
      },
    ]);
    viewPost(wss, "update-view-post", post.userId, postId);

    res.status(200).json({ post, relatedPosts: relatedPosts });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
formPostCheckRouter.post("/get-post-check-list-accept", checkAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const allPostCheck = await FormPostCheck.find({
      hidden: false,
      censorship: true,
    });

    const userPostCheck = await FormPostCheck.find({
      userId,
      hidden: false,
      censorship: true,
    });

    userPostCheck.forEach((post) => {
      const index = allPostCheck.findIndex((p) => p._id.toString() === post._id.toString());
      if (index !== -1) {
        post.currentPage = Math.floor(index / 7) + 1;
      }
    });

    res.status(200).json({ data: userPostCheck, status: "SUCCESS", totalPage: allPostCheck.length / 7 });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
formPostCheckRouter.get("/get-posts-current", async (req, res) => {
  try {
    const latestPosts = await FormPostCheck.find({ censorship: true, hidden: false }).sort({ date: -1 }).limit(12);

    res.status(200).json({ latestPosts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
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
    const {
      pageSize,
      currentPage,
      price,
      form,
      sit,
      fuel,
      numberBox,
      city,
      district,
      date,
      km,
      color,
      country,
      model,
      brand,
      status,
      post,
      keySearch,
    } = req.query;
    let filter = {
      hidden: false,
      censorship: true,
    };
    if (country !== "undefined") {
      const dataRender = countriesCar.find((item) => item.value === country);
      filter["post.country"] = { $eq: dataRender.item };
    }
    if (model !== "undefined") {
      filter["post.model"] = { $eq: model };
    }
    if (brand !== "undefined") {
      filter["post.value"] = { $eq: brand };
    }

    if (status !== "undefined") {
      const dataRender = statusCar.find((item) => item.value === status);
      filter["post.status"] = { $eq: dataRender?.item };
    }
    if (post !== "undefined" && post !== "all") {
      if (post === "ca-nhan") {
        filter["post.person"] = { $eq: "Cá nhân" };
      } else {
        const dataRender = postCar.find((item) => item.value === post);
        filter["post.person"] = { $eq: dataRender?.item };
      }
    }

    if (city !== "undefined") {
      filter["post.cityValue"] = { $eq: city };
    }
    if (district !== "undefined") {
      filter["post.districtValue"] = { $eq: district };
    }
    if (km !== "undefined") {
      const kmParams = km.split("-");
      if (kmParams.length === 1) {
        const match = kmParams[0].match(/(min|max)(\d+)/);
        if (match) {
          if (match[1] === "min") {
            filter["post.km"] = { $gte: match[2] };
          } else if (match[1] === "max") {
            filter["post.km"] = { $lte: match[2] };
          }
        }
      } else if (kmParams.length === 2) {
        filter["post.km"] = { $lte: kmParams[1], $gte: kmParams[0] };
      }
    }
    if (color !== "undefined") {
      const dataRender = colorsCar.find((item) => item.value === color);
      filter["post.color"] = { $eq: dataRender.item };
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

    if (date !== "undefined") {
      const dateParams = date.split("-");
      if (dateParams.length === 1) {
        const match = dateParams[0].match(/(min|max)(\d+)/);
        if (match) {
          if (match[1] === "min") {
            filter["post.dateCar"] = { $gte: match[2] };
          } else if (match[1] === "max") {
            filter["post.dateCar"] = { $lte: match[2] };
          }
        }
      } else if (dateParams.length === 2) {
        filter["post.dateCar"] = { $lte: dateParams[1], $gte: dateParams[0] };
      }
    }
    if (price !== "undefined") {
      const [lowerPrice, upperPrice] = price.split("-").map((item) => parseInt(item));
      const match = price.match(/(min|max)(\d+)/);

      // const match = dateParams[0].match(/(min|max)(\d+)/);
      console.log(match);
      if (price === "un200tr") {
        filter["post.price"] = { $lte: 200000000 };
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
      } else if (match !== null && match[1] === "max") {
        filter["post.price"] = { $lte: match[2] };
      } else if (match !== null && match[1] === "min") {
        filter["post.price"] = { $gte: match[2] };
      } else {
        if (!isNaN(lowerPrice) && !isNaN(upperPrice)) {
          filter["post.price"] = { $gte: lowerPrice, $lte: upperPrice };
        } else {
          // Xử lý nếu giá trị không hợp lệ
        }
      }
    }
    if (keySearch !== "undefined" && keySearch.trim() !== "") {
      const searchLowerCase = removeAccents(keySearch.toLowerCase().trim());

      // Tìm kiếm các bài viết có tiêu đề chứa phần `keySearch` (không phân biệt chữ hoa chữ thường và không phân biệt dấu)
      const posts = await FormPostCheck.find(filter);

      // Thay đổi thông tin userInfo của mỗi bài đăng
      const updatedPosts = await Promise.all(
        posts.map(async (post) => {
          const user = await User.findById(post.userId);
          if (user) {
            // Nếu tìm thấy người dùng, thay đổi thông tin userInfo
            post.userInfo = {
              avatar: user.avatar,
              fullName: user.fullname,
              // Thêm các thông tin khác nếu cần
            };
          }
          return post;
        })
      );
      const sortedPosts = updatedPosts.sort((a, b) => {
        const prioritizeOrder = ["26.51", "15.71", "14.73", null];
        const indexA = prioritizeOrder.indexOf(a.prioritize);
        const indexB = prioritizeOrder.indexOf(b.prioritize);

        if (indexA !== indexB) {
          return indexA - indexB;
        }

        if (a.prioritize === null && b.prioritize === null) {
          return new Date(b.date) - new Date(a.date);
        }

        return 0;
      });
      const matchingPosts = sortedPosts.filter((post) => {
        const titleLowerCase = removeAccents(post.post.title.toLowerCase());
        return titleLowerCase.includes(searchLowerCase);
      });

      const totalRecords = matchingPosts.length;
      const paginatedPosts = matchingPosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

      return res.status(200).json({ data: paginatedPosts, status: "SUCCESS", total: totalRecords });
    } else {
      const totalRecords = await FormPostCheck.countDocuments(filter);
      // const posts = await FormPostCheck.find(filter)
      //   .skip((currentPage - 1) * pageSize)
      //   .limit(pageSize);
      const posts = await FormPostCheck.find(filter);

      // Thay đổi thông tin userInfo của mỗi bài đăng
      const updatedPosts = await Promise.all(
        posts.map(async (post) => {
          const user = await User.findById(post.userId);
          if (user) {
            post.userInfo = {
              avatar: user.avatar,
              fullName: user.fullname,
              selling: user.selling,
              selled: user.selled,

              // Thêm các thông tin khác nếu cần
            };
          }
          return post;
        })
      );
      const sortedPosts = updatedPosts.sort((a, b) => {
        const prioritizeOrder = ["26.51", "15.71", "14.73", null];
        const indexA = prioritizeOrder.indexOf(a.prioritize);
        const indexB = prioritizeOrder.indexOf(b.prioritize);

        if (indexA !== indexB) {
          return indexA - indexB;
        }

        if (a.prioritize === null && b.prioritize === null) {
          return new Date(b.date) - new Date(a.date);
        }

        return 0;
      });
      const paginatedPosts = sortedPosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

      res.status(200).json({ data: paginatedPosts, status: "SUCCESS", total: totalRecords });
    }
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
    const { postId } = req.body;

    const postCheck = await FormPostCheck.findOneAndUpdate({ userId: userId, postId: postId }, { hidden: false }, { new: true });

    if (!postCheck) {
      return res.status(404).json({
        message: "Không tìm thấy bài đăng hoặc không có quyền truy cập",
        status: "ERROR",
      });
    }
    const userPosts = await FormPostCheck.find({
      userId: postCheck.userId,
    });

    const acceptedPostsCount = userPosts.filter((post) => post.censorship === true && post.hidden === false).length;
    const hiddenPostsCount = userPosts.filter((post) => post.hidden === true && post.censorship === true).length;
    await Promise.all(
      userPosts.map(async (post) => {
        await post.updateOne({
          $set: {
            "userInfo.selling": acceptedPostsCount,
            "userInfo.selled": hiddenPostsCount,
          },
        });
      })
    );

    res.status(200).json({ data: postCheck, status: "SUCCESS" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});
formPostCheckRouter.put("/edit-post-form-sell-check", upload.array("image", 20), checkAccessToken, async (req, res) => {
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

    const updatedPost = await FormPostCheck.findOneAndUpdate({ postId: postId }, { $set: { hidden: true } }, { new: true });
    const userPosts = await FormPostCheck.find({
      userId: updatedPost.userId,
    });

    const acceptedPostsCount = userPosts.filter((post) => post.censorship === true && post.hidden === false).length;
    const hiddenPostsCount = userPosts.filter((post) => post.hidden === true && post.censorship === true).length;
    await Promise.all(
      userPosts.map(async (post) => {
        await post.updateOne({
          $set: {
            "userInfo.selling": acceptedPostsCount,
            "userInfo.selled": hiddenPostsCount,
          },
        });
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

export function removeAccents(str) {
  const accentMap = {
    a: "á|à|ả|ã|ạ|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ",
    d: "đ",
    e: "é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ",
    i: "í|ì|ỉ|ĩ|ị",
    o: "ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ",
    u: "ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự",
    y: "ý|ỳ|ỷ|ỹ|ỵ",
  };

  for (let char in accentMap) {
    let regex = new RegExp(accentMap[char], "g");
    str = str.replace(regex, char);
  }

  return str;
}
formPostCheckRouter.post("/key-search", async (req, res) => {
  const { price, form, sit, fuel, numberBox, city, district, date, km, color, country, model, brand, status, post, keySearch } = req.query;
  try {
    let filter = {
      hidden: false,
      censorship: true,
    };
    if (country !== "undefined") {
      const dataRender = countriesCar.find((item) => item.value === country);
      filter["post.country"] = { $eq: dataRender.item };
    }
    if (model !== "undefined") {
      filter["post.model"] = { $eq: model };
    }
    if (brand !== "undefined") {
      filter["post.value"] = { $eq: brand };
    }
    if (status !== "undefined") {
      const dataRender = statusCar.find((item) => item.value === status);
      filter["post.status"] = { $eq: dataRender.item };
    }
    if (post !== "undefined") {
      const dataRender = postCar.find((item) => item.value === post);
      filter["post.person"] = { $eq: dataRender.item };
    }
    if (city !== "undefined") {
      filter["post.cityValue"] = { $eq: city };
    }
    if (district !== "undefined") {
      filter["post.districtValue"] = { $eq: district };
    }
    if (km !== "undefined") {
      const kmParams = km.split("-");
      if (kmParams.length === 1) {
        const match = kmParams[0].match(/(min|max)(\d+)/);
        if (match) {
          if (match[1] === "min") {
            filter["post.km"] = { $gte: match[2] };
          } else if (match[1] === "max") {
            filter["post.km"] = { $lte: match[2] };
          }
        }
      } else if (kmParams.length === 2) {
        filter["post.km"] = { $lte: kmParams[1], $gte: kmParams[0] };
      }
    }
    if (color !== "undefined") {
      const dataRender = colorsCar.find((item) => item.value === color);
      filter["post.color"] = { $eq: dataRender.item };
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

    if (date !== "undefined") {
      const dateParams = date.split("-");
      if (dateParams.length === 1) {
        const match = dateParams[0].match(/(min|max)(\d+)/);
        if (match) {
          if (match[1] === "min") {
            filter["post.dateCar"] = { $gte: match[2] };
          } else if (match[1] === "max") {
            filter["post.dateCar"] = { $lte: match[2] };
          }
        }
      } else if (dateParams.length === 2) {
        filter["post.dateCar"] = { $lte: dateParams[1], $gte: dateParams[0] };
      }
    }
    if (price !== "undefined") {
      const [lowerPrice, upperPrice] = price.split("-").map((item) => parseInt(item));
      const match = price.match(/(min|max)(\d+)/);

      // const match = dateParams[0].match(/(min|max)(\d+)/);
      if (price === "un200tr") {
        filter["post.price"] = { $lte: 200000000 };
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
      } else if (match !== null && match[1] === "max") {
        filter["post.price"] = { $lte: match[2] };
      } else if (match !== null && match[1] === "min") {
        filter["post.price"] = { $gte: match[2] };
      } else {
        if (!isNaN(lowerPrice) && !isNaN(upperPrice)) {
          filter["post.price"] = { $gte: lowerPrice, $lte: upperPrice };
        } else {
          // Xử lý nếu giá trị không hợp lệ
        }
      }
    }
    const posts = await FormPostCheck.find(filter);
    let matchingTitles;
    if (!keySearch) {
      matchingTitles = posts.map((post) => post.post.title);
    } else {
      const searchLowerCase = removeAccents(keySearch.toLowerCase().trim());
      matchingTitles = posts
        .map((post) => post.post.title)
        .filter((title) => {
          const titleLowerCase = removeAccents(title.toLowerCase());
          return titleLowerCase.includes(searchLowerCase);
        });
    }

    res.status(200).json({ titles: matchingTitles, status: "SUCCESS" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
export default formPostCheckRouter;
