const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const { WebcastPushConnection } = require('tiktok-live-connector');




app.use(cors());
app.options('*', cors());
var allowCrossDomain = function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}
app.use(allowCrossDomain);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var username;
var connected = false;
const server = http.createServer(app)
const wss = new Server(server, {
  cors: {
    methods: ["GET", "POST"],
    allowedHeaders: ["chat-traffic"],
  }
});
const PORT = 3000;
wss.on('connection', (socket) => {

    socket.on('tryConnection', name => {
      chatStream(name)
    })

})

function getRoleColor(roleInfo) {
  switch(roleInfo) {
    case (roleInfo[0] == 1):
      return "#D3D3D3";
    case (roleInfo[1] == true):
      return "#03FFC4";
    case (roleInfo[2] == true):
      return "#FF4629";
    default:
      return "FFFFFF";
    }
}

function chatStream(uName) {
  let username = uName || null;

  if (username != null || username != '') {
    let tiktokLiveConnection = new WebcastPushConnection(username, {
      enableExtendedGiftInfo: true,
      fetchRoomInfoOnConnect: true
    });

    tiktokLiveConnection.connect().then(state => {
      console.info(`Connected to room (ID): ${state.roomId}`)
      wss.emit('connectionSuccessful')
    }).catch(err => {
      console.error('Failed to connect', err)
      wss.emit('connectionUnsuccessful')
    })

    tiktokLiveConnection.on('chat', data => {
      let out = {
        nickname: data.uniqueId,
        msgContent: data.comment,
        profilePictureUrl: data.profilePictureUrl,
        color: getRoleColor([data.rollowRole,  data.isModerator, data.isSubscriber])
      }
      wss.emit('chatMessage', JSON.stringify(out));
    })
  }

}


server.listen(PORT, () => {
  console.log(`Tiktok Monitor is listening at http://localhost:${PORT}`)
})
