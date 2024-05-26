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
import { sendAnnouce } from "../middleware/sendAnnounce.js";

const chatRouter = express.Router();
chatRouter.use(cors());
const wss = new WebSocketServer({ port: 8085 ,path:'/ws'});
function isSameDay(date1, date2) {
  return date1.getDate() === date2.getDate() && date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
}
wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (message) => {
    console.log("received: %s", message);
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});
chatRouter.post("/post-message", checkAccessToken, async (req, res) => {
  try {
    const { text, idRoom } = req.body;
    console.log(text);
    const userId = req.user.id;
    const chatRoom = await Chat.findOne({ idRoom: idRoom });

    const newMessage = {
      time: new Date(),
      userId: userId,
      text: text,
    };
    const messages = chatRoom.messagesRoom.message;
    const currentDate = newMessage.time;

    if (messages.length === 0) {
      newMessage.firstTextDate = currentDate;
    } else {
      const lastMessage = messages[messages.length - 1];

      if (!isSameDay(lastMessage.time, currentDate)) {
        newMessage.firstTextDate = currentDate;
      } else {
        const firstMessageOfDay = messages.find((msg) => isSameDay(msg.time, currentDate));
        if (!firstMessageOfDay) {
          newMessage.firstTextDate = currentDate;
        }
      }
    }
    chatRoom.messagesRoom.message.push(newMessage);
    if (userId === chatRoom.userSend) {
      chatRoom.userReceivePop = true;
    } else {
      chatRoom.userSendPop = true;
    }
    await chatRoom.save();

    webSocketChat(wss, "post-message", idRoom);
    if (userId === chatRoom.userSend) {
      const userPop = await User.findById(chatRoom.userReceive);
      userPop.announceChat = true;
      await userPop.save();
      sendAnnouce(wss, "annouce", chatRoom.userReceive, "chat");
    } else {
      const userPop = await User.findById(chatRoom.userSend);
      userPop.announceChat = true;
      await userPop.save();
      sendAnnouce(wss, "annouce", chatRoom.userSend, "chat");
    }
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

    const idRooms = hiddenChatList.map((chat) => chat.idRoom);
    const chats = await Chat.find({ idRoom: { $in: idRooms } });

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

    const chats = await Chat.find({ idRoom: { $in: idRoom } });

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
    const userSendInfo = await User.findById(chatRoom[0].userSend).select("fullname avatar");
    const userReceiveInfo = await User.findById(chatRoom[0].userReceive).select("fullname avatar");
    const formPostChecks = await FormPostCheck.find({ postId: chatRoom[0].postId }).select(
      "userInfo.fullName post.image.img post.title post.price postId"
    );

    if (req.user.id === chatRoom[0].userReceive) {
      chatRoom[0].userReceivePop = false;
    } else if (req.user.id === chatRoom[0].userSend) {
      chatRoom[0].userSendPop = false;
    }

    await chatRoom[0].save();
    const allChatRooms = await Chat.find({ userReceive: req.user.id });
    const allPopsFalse = allChatRooms.every((room) => room.userReceivePop === false);

    if (allPopsFalse) {
      const userPop = await User.findById(req.user.id);
      userPop.announceChat = false;
      await userPop.save();
    }
    chatRoom[0] = {
      ...chatRoom[0]._doc,
      userSendInfo: {
        _id: userSendInfo._id,
        fullName: userSendInfo.fullname,
        avatar: userSendInfo.avatar,
      },
      userReceiveInfo: {
        _id: userReceiveInfo._id,
        fullName: userReceiveInfo.fullname,
        avatar: userReceiveInfo.avatar,
      },
      formPostChecks: formPostChecks.map((fp) => ({
        _id: fp._id,
        userInfo: fp.userInfo,
        post: fp.post,
        postId: fp.postId,
      })),
    };
    sendAnnouce(wss, "annouce", chatRoom[0].userReceive, "chat");
    sendAnnouce(wss, "annouce", chatRoom[0].userSend, "chat");

    res.status(200).json(chatRoom[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    const updatedPosts = await Promise.all(
      updatedConversations.map(async (conversation) => {
        const userReceiveData = await User.findById(conversation.userReceive).select("fullname avatar");
        const userSendData = await User.findById(conversation.userSend).select("fullname avatar");
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
    const filteredUpdatedPosts = updatedPosts.filter((post) => post);

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

    const updatedConversations = filteredConversations.map((conversation) => {
      const messages = conversation.messagesRoom.message;
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        conversation.lastText = lastMessage.text;
        conversation.lastTextToNow = lastMessage.time;
      }
      return {
        userReceivePop: conversation.userSendPop,
        userSendPop: conversation.userReceivePop,
        idRoom: conversation.idRoom,
        lastText: conversation.lastText,
        lastTextToNow: conversation.lastTextToNow,
        postId: conversation.postId,
      };
    });
    updatedConversations.sort((a, b) => {
      const aTime = new Date(a.lastTextToNow).getTime();
      const bTime = new Date(b.lastTextToNow).getTime();
      return bTime - aTime;
    });
    res.status(200).json(updatedConversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default chatRouter;
