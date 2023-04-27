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

var nickname = "";
var dispName = "";
var handle = "";
var bio = "";
var streamerFollowers = 0;
var streamerFollowing = 0;
var connected = false;
const server = http.createServer(app)
const wss = new Server(server, {
  cors: {
    methods: ["GET", "POST"],
    allowedHeaders: ["chat-traffic"],
  }
});
const PORT = process.env.PORT || 3000;

let serverUp = false;

wss.on('connection', (socket) => {

  socket.on('tryConnection', name => {
    tteStream(name, function (cb) {
      if (cb.code === "success") {
        dispName = cb.nickname;
        bio = cb.bio_description;
        streamerFollowers = cb.follow_info.follower_count;
        streamerFollowing = cb.follow_info.following_count; 
        let payload = JSON.stringify(cb);
        socket.emit('connected', payload);
      };
    })
  })
})

async function isHighlighted(msg, broadcaster) {
  msg = String(msg);
  let output = false;
  let broadcasterComparator = "@" + broadcaster;
  let wordArr = msg.split(" ");
  for (word in wordArr) {
    if (word == broadcasterComparator) output = true;
  }
  return output;
}

function getRoleColor(roleInfo) {

  if (roleInfo[0]) return "#ff00bb";
  else if (roleInfo[1]) return "#9aff67";
  else if (roleInfo[2] == 1) return "#f2b171";
  else return "#d3d3d3"

}

function tteStream(uName, callback) {
  let username = uName || null;

  if (username != null || username != '') {
    let tiktokLiveConnection = new WebcastPushConnection(username, {
      enableExtendedGiftInfo: true,
      fetchRoomInfoOnConnect: true
    });

    function evtManager(data, type) {
      let out = {};
      let currentDate = new Date();
      let msgColor = getRoleColor([data.isModerator, data.isSubscriber, data.rollowRole]);

      switch (type) {
        case 'gift':

          if (data.repeatEnd) {
            let dConversion = (data.diamondCount * 0.05) / 2;

            let price = (dConversion * data.repeatCount).toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
            })
            let priceString = "$" + price
            out = {
              type: 'gift',
              nickname: data.uniqueId,
              giftType: data.giftName,
              giftCount: data.repeatCount,
              priceValue: price,
              icon: data.giftPictureUrl,
              timeStamp: currentDate.toLocaleTimeString(),
              profilePictureUrl: data.profilePictureUrl,
              followCount: data.followInfo.followerCount,
              color: msgColor,
              badges: data.userBadges
            }
          }
          break;
        case 'subscribe':
          out = {
            type: 'subscribe',
            nickname: data.uniqueId,
            months: data.subMonth,
            timeStamp: currentDate.toLocaleTimeString(),
            profilePictureUrl: data.profilePictureUrl,
            followCount: data.followInfo.followerCount,
            color: msgColor,
            badges: data.userBadges
          }
          break;
        case 'follow':
          out = {
            type: 'follow',
            nickname: data.uniqueId,
            timeStamp: currentDate.toLocaleTimeString(),
            profilePictureUrl: data.profilePictureUrl,
            followCount: data.followInfo.followerCount,
            color: msgColor,
            badges: data.userBadges
          }
          break;
        case 'share':
          out = {
            type: 'share',
            nickname: data.uniqueId,
            timeStamp: currentDate.toLocaleTimeString(),
            profilePictureUrl: data.profilePictureUrl,
            followCount: data.followInfo.followerCount,
            color: msgColor,
            badges: data.userBadges
          }
          break;
      }
      return out;
    }

    tiktokLiveConnection.connect().then(state => {
      let callbackValue = {code: "success", state: state.roomInfo.owner};
      console.info(`Connected to room (ID): ${state.roomId}`)
      callback(callbackValue);
      ;
      serverUp = true;
      
    }).catch(err => {
      let callbackValue = {code: "failed"};
      console.error(err);
      callback(callbackValue);
    })

    tiktokLiveConnection.on('disconnected', () => {
      wss.emit('dcSuccess')
    })

    wss.on('beginDC', () => {
      console.log('Disconnected');
      tiktokLiveConnection.disconnect();
      wss.emit('dcSuccess')
    });

    tiktokLiveConnection.on('chat', data => {
      let msgColor = getRoleColor([data.isModerator, data.isSubscriber, data.rollowRole]);
      let highlight = isHighlighted(data.comment, data.uniqueId);
      let currentDate = new Date();
      let createDate = new Date(Number(data.userDetails.createTime));
      let out = {
        nickname: data.uniqueId,
        msgContent: data.comment,
        profilePictureUrl: data.profilePictureUrl,
        highlightMsg: highlight,
        timeStamp: currentDate.toLocaleTimeString(),
        followCount: data.followInfo.followerCount,
        bio: data.userDetails.bioDescription,
        roles: [{role: "mod", value: data.isModerator}, {role: "sub", value: data.isSubscriber}, {role: "default", value: data.rollowRole == 1}],
        createDate: createDate.toDateString
      }

      wss.emit('chatMessage', JSON.stringify(out));

    })

    tiktokLiveConnection.on('gift', data => {
      let out = evtManager(data, 'gift');
      wss.emit('evtMessage', JSON.stringify(out));
    })

    tiktokLiveConnection.on('subscribe', data => {
      let out = evtManager(data, 'subscribe');
      wss.emit('evtMessage', JSON.stringify(out));
    })

    tiktokLiveConnection.on('follow', data => {
      let out = evtManager(data, 'follow');
      wss.emit('evtMessage', JSON.stringify(out));
    })

    tiktokLiveConnection.on('share', data => {
      let out = evtManager(data, 'share');
      wss.emit('evtMessage', JSON.stringify(out));
    })

    tiktokLiveConnection.on('roomUser', data => {
      let out = {
        type: 'roomUser',
        viewers: data.viewerCount,
        displayName: dispName,
        followers: followCount,
        following: followingCount,
        bio: bio
      }
      wss.emit('updateInfo', JSON.stringify(out))
    })

  }

}


server.listen(PORT, () => {
  console.log(`Tiktok Monitor is listening at http://localhost:${PORT}`)
})
