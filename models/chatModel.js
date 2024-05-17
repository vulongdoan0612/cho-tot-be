import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const chatSchema = new mongoose.Schema({
  idRoom: { type: String },
  userSend: { type: String },
  hiddenReceive: { type: Boolean, default: false },
  hiddenSend: { type: Boolean, default: false },
  userReceive: { type: String },
  postId: { type: String },
  lastText: { type: String },
  userSendPop: { type: Boolean, default: false },
  userReceivePop: { type: Boolean, default: false },
  lastTextToNow: { type: Date },
  messagesRoom: {
    message: [
      {
        time: { type: Date, default: Date.now },
        userId: { type: String },
        text: { type: String },
        firstTextDate: { type: Date, default: null },
      },
    ],
  },
});

chatSchema.statics.findOrCreateRoom = async function (userSend, userReceive, postId = null) {
  let room;

  if (postId) {
    room = await this.findOne({ userSend, userReceive, postId });
    if (!room) {
      room = await this.findOne({ userSend: userReceive, userReceive: userSend, postId });
    }
  } else {
    room = await this.findOne({ userSend, userReceive });
    if (!room) {
      room = await this.findOne({ userSend: userReceive, userReceive: userSend });
    }
  }

  if (!room) {
    const idRoom = uuidv4();
    room = new this({ idRoom, userSend, userReceive, postId });
    await room.save();
  }

  return room;
};

const Chat = mongoose.model("Chat", chatSchema);

export default Chat;
