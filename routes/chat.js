import express from "express";
import cors from "cors";
import { checkAccessToken } from "../middleware/authMiddleware.js";
import { WebSocket, WebSocketServer } from "ws";
import { webSocketMessage } from "../middleware/sendWebSocketMessage.js";
import Chat from "../models/chatModel.js";
import FormPostCheck from "../models/formPostCheckModel.js";
import User from "../models/userModel.js";
import { webSocketChat } from "../middleware/sendWebSocketChat.js";
import { webSocketCreateRoom } from "../middleware/createWebSocketChat.js";

const chatRouter = express.Router();
chatRouter.use(cors());
const wss = new WebSocketServer({ port: 8085 });
function isSameDay(date1, date2) {
  return date1.getDate() === date2.getDate() && date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
}

chatRouter.post("/post-message", checkAccessToken, async (req, res) => {
  try {
    const { text, idRoom } = req.body;
    const userId = req.user.id;
    const chatRoom = await Chat.findOne({ idRoom: idRoom });

    const newMessage = {
      time: new Date(),
      userId: userId,
      text: text,
    };
    if (chatRoom.messagesRoom.message.length > 0) {
      const lastMessage = chatRoom.messagesRoom.message[0];
      const currentDate = newMessage.time;

      if (!isSameDay(lastMessage.time, currentDate)) {
        newMessage.firstTextDate = newMessage.time;
      }
    } else {
      newMessage.firstTextDate = newMessage.time;
    }
    chatRoom.messagesRoom.message.push(newMessage);
    await chatRoom.save();

    webSocketChat(wss, "post-message", idRoom);

    res.status(200).json(chatRoom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
chatRouter.post("/create-room", checkAccessToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;
    const formPostCheck = await FormPostCheck.findOne({ postId: postId });
    const currentTime = new Date();

    if (!formPostCheck) {
      return res.status(404).json({ message: "No data found for this postId" });
    }

    const chatRoom = await Chat.findOrCreateRoom(userId, formPostCheck.userId, postId);
    if (chatRoom.messagesRoom.message.length === 0) {
      chatRoom.lastTextToNow = currentTime;
    }
    await chatRoom.save();

    webSocketCreateRoom(wss, "create-room", formPostCheck.userId, userId);

    res.status(200).json(chatRoom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
chatRouter.post("/set-hidden", checkAccessToken, async (req, res) => {
  try {
    const { hiddenChatList } = req.body;
    const userId = req.user.id;
    // Find the chat with the given idRoom
    const idRooms = hiddenChatList.map((chat) => chat.idRoom);
    const chats = await Chat.find({ idRoom: { $in: idRooms } }); // Set hidden to true for each chat and save

    await Promise.all(
      chats.map(async (chat) => {
        if (chat.userSend.toString() === userId) {
          chat.hiddenSend = true;
        } else if (chat.userReceive.toString() === userId) {
          chat.hiddenReceive = true;
        }
        await chat.save();
      })
    );
    return res.status(200).json({ message: "Hidden set to true successfully" });
  } catch (error) {
    console.error("Error setting hidden:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
chatRouter.post("/set-hidden-false", checkAccessToken, async (req, res) => {
  try {
    const { idRoom } = req.body;
    const userId = req.user.id;
    // Find the chat with the given idRoom
    const chats = await Chat.find({ idRoom: { $in: idRoom } });

    // Set hidden to false for each chat and save
    await Promise.all(
      chats.map(async (chat) => {
        if (userId === chat.userSend) {
          chat.hiddenSend = false;
        }
        if (userId === chat.userReceive) {
          chat.hiddenReceive = false;
        }
        await chat.save();
      })
    );
    return res.status(200).json({ message: "Hidden set to false successfully" });
  } catch (error) {
    console.error("Error setting hidden to false:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
chatRouter.post("/get-conversation", checkAccessToken, async (req, res) => {
  try {
    const { idRoom } = req.body;
    const chatRoom = await Chat.find({ idRoom });
    if (!chatRoom.length) {
      return res.status(404).json({ error: "Chat room not found" });
    }
    const userSendInfo = await User.findById(chatRoom[0].userSend).select("fullname");
    const userReceiveInfo = await User.findById(chatRoom[0].userReceive).select("fullname");
    const formPostChecks = await FormPostCheck.find({ postId: chatRoom[0].postId }).select(
      "userInfo.fullName post.image.img post.title post.price postId"
    );

    chatRoom[0] = {
      ...chatRoom[0]._doc,
      userSendInfo: {
        _id: userSendInfo._id,
        fullName: userSendInfo.fullname,
      },
      userReceiveInfo: {
        _id: userReceiveInfo._id,
        fullName: userReceiveInfo.fullname,
      },
      formPostChecks: formPostChecks.map((fp) => ({
        _id: fp._id,
        userInfo: fp.userInfo,
        post: fp.post,
        postId: fp.postId,
      })),
    };
    res.status(200).json(chatRoom[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
function removeAccents(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
chatRouter.post("/get-all-conversation", checkAccessToken, async (req, res) => {
  try {
    const { search, typeChat } = req.body;
    const userId = req.user.id;

    const conversations = await Chat.find({
      $or: [{ userSend: userId }, { userReceive: userId }],
    });

    const filteredConversations = conversations.filter((conversation) => {
      if (typeChat === "all") {
        if (userId === conversation.userReceive) {
          return !conversation.hiddenReceive;
        } else if (userId === conversation.userSend) {
          return !conversation.hiddenSend;
        }
      } else {
        if (userId === conversation.userReceive) {
          return conversation.hiddenReceive;
        } else if (userId === conversation.userSend) {
          return conversation.hiddenSend;
        }
      }
      return false;
    });
    const updatedConversations = filteredConversations.map((conversation) => {
      const messages = conversation.messagesRoom.message;
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        conversation.lastText = lastMessage.text;
        conversation.lastTextToNow = lastMessage.time;
      }
      return conversation;
    });
    const postIds = updatedConversations.map((item) => item.postId);
    const posts = await FormPostCheck.find({ postId: { $in: postIds }, censorship: true, hidden: false }).select(
      "userInfo.fullName post.image.img post.title post.price postId "
    );
    const filteredPosts = search
      ? posts.filter((post) => {
          const regex = new RegExp(`^${search}`, "i");
          return regex.test(post.userInfo.fullName);
        })
      : posts;

    const updatedPosts = await Promise.all(
      updatedConversations.map(async (conversation) => {
        const userReceiveData = await User.findById(conversation.userReceive).select("fullname");
        const userSendData = await User.findById(conversation.userSend).select("fullname");
        let fullNameLowerCase;
        if (req.user.id === conversation.userSend) {
          fullNameLowerCase = userReceiveData.fullname.toLowerCase().trim();
        } else if (req.user.id === conversation.userReceive) {
          fullNameLowerCase = userSendData.fullname.toLowerCase().trim();
        }
        const searchLowerCase = removeAccents(search.toLowerCase().trim());
        if (fullNameLowerCase && removeAccents(fullNameLowerCase).includes(searchLowerCase)) {
          const post = posts.find((p) => p.postId === conversation.postId);
          return {
            ...post._doc,
            idRoom: conversation.idRoom,
            userReceive: userReceiveData,
            userSend: userSendData,
            lastText: conversation.lastText,
            lastTextToNow: conversation.lastTextToNow,
          };
        }
      })
    );
    const filteredUpdatedPosts = updatedPosts.filter((post) => post); // Lọc bỏ các giá trị null

    res.status(200).json(filteredUpdatedPosts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
chatRouter.post("/get-all-conversation-summary", checkAccessToken, async (req, res) => {
  try {
    const { typeChat } = req.body;
    const userId = req.user.id;
    const conversations = await Chat.find({
      $or: [{ userSend: userId }, { userReceive: userId }],
    });
    const filteredConversations = conversations.filter((conversation) => {
      if (typeChat === "all") {
        if (userId === conversation.userReceive) {
          return !conversation.hiddenReceive;
        } else if (userId === conversation.userSend) {
          return !conversation.hiddenSend;
        }
      } else {
        if (userId === conversation.userReceive) {
          return conversation.hiddenReceive;
        } else if (userId === conversation.userSend) {
          return conversation.hiddenSend;
        }
      }
      return false;
    });

    // const conversations = await Chat.find(condition);

    // Cập nhật lastText và lastTextToNow cho mỗi cuộc trò chuyện
    const updatedConversations = filteredConversations.map((conversation) => {
      const messages = conversation.messagesRoom.message;
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        conversation.lastText = lastMessage.text;
        conversation.lastTextToNow = lastMessage.time;
      }
      return {
        idRoom: conversation.idRoom,
        lastText: conversation.lastText,
        lastTextToNow: conversation.lastTextToNow,
      };
    });

    res.status(200).json(updatedConversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default chatRouter;
