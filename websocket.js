import { WebSocket, WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8085 });

wss.on("connection", (ws) => {
  console.log("New WebSocket client connected");

  ws.on("message", (message) => {
    console.log("Received:", message);
    // Xử lý message từ client
  });

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

export const webSocketChat = ( action, idRoom) => {
  const message = JSON.stringify({ action, idRoom });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};
export const sendAnnouce = ( action, userId, announce) => {
  const message = JSON.stringify({ action, userId, announce });

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

console.log("WebSocket Server is running on port 8085");
