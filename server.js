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

async function isHighlighted(msg, broadcaster) {
  let output = false;
  let broadcasterComparator = "@" + broadcaster;
  let wordArr = msg.split(" ");
  for (word in wordArr) {
    if (word == broadcasterComparator) output = true;
  }
  return output;
}

function getRoleColor(roleInfo) {

  if (roleInfo[0]) return "FF4629";
  else if (roleInfo[1]) return "03FFC4";
  else if (roleInfo[2] == 1) return "D3D3D3";
  else return "#ed909b"

}

function chatStream(uName) {
  let username = uName || null;

  if (username != null || username != '') {
    let tiktokLiveConnection = new WebcastPushConnection(username, {
      enableExtendedGiftInfo: true,
      fetchRoomInfoOnConnect: true
    });

function evtManager(data, type) {
  let out = {};
  switch (type) {
    case 'gift':
      out = {
        type: 'gift',
        nickname: data.uniqueId,
        giftType: data.giftName,
        giftCount: data.repeatCount,
        priceValue: data.diamondCount,
        icon: data.giftPictureUrl,
        timeStamp: new Date().getTime()
      }
      break;
    case 'subscribe':
      out = {
        type: 'subscribe',
        nickname: data.uniqueId,
        months: data.subMonth,
        timeStamp: new Date().getTime()
      }
      break;
    case 'follow':
      out = {
        type: 'follow',
        nickname: data.uniqueId,
        timeStamp: new Date().getTime()
      }
      break;
    case 'share':
      out = {
        type: 'share',
        nickname: data.uniqueId,
        timeStamp: new Date().getTime()
      }
  }
  return out;
}

    tiktokLiveConnection.connect().then(state => {
      console.info(`Connected to room (ID): ${state.roomId}`)
      wss.emit('connectionSuccessful')
    }).catch(err => {
      console.error('Failed to connect', err)
      wss.emit('connectionUnsuccessful')
    })

    tiktokLiveConnection.on('chat', async data => {
      let msgColor = getRoleColor([data.isModerator, data.isSubscriber, data.rollowRole]);
      let highlight = await (isHighlighted(data.comment, data.uniqueId));
      let out = {
        nickname: data.uniqueId,
        msgContent: data.comment,
        profilePictureUrl: data.profilePictureUrl,
        color: msgColor,
        highlightMsg: highlight
      }

      wss.emit('chatMessage', JSON.stringify(out));

    })

    tiktokLiveConnection.on('gift', async data => {
      let out = evtManager(data, 'gift');
      wss.emit('evtMessage', JSON.stringify(out));
    })

    tiktokLiveConnection.on('subscribe', async data => {
      let out = evtManager(data, 'subscribe');
      wss.emit('evtMessage', JSON.stringify(out));
    })

    tiktokLiveConnection.on('follow', async data => {
      let out = evtManager(data, 'follow');
      wss.emit('evtMessage', JSON.stringify(out));
    })

    tiktokLiveConnection.on('share', async data => {
      let out = evtManager(data, 'share');
      wss.emit('evtMessage', JSON.stringify(data));
    })
  }

}


server.listen(PORT, () => {
  console.log(`Tiktok Monitor is listening at http://localhost:${PORT}`)
})
