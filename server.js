const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();

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

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Tiktok Monitor is listening at http://localhost:${PORT}`)
})

var username;

function connectToLive(req, res, next) {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  };
  if (req.method == "POST") {

    username = req.body.name

  }

}
function chatStream(req, res) {


  if (username != null || username != '') {
    let tiktokLiveConnection = new WebcastPushConnection(username, {
      enableExtendedGiftInfo: true,
      fetchRoomInfoOnConnect: true
    });

    tiktokLiveConnection.connect().then(state => {
      console.info(`Connected to room (ID): ${state.roomId}`)}).catch(err => {
      console.error('Failed to connect', err)
    })

    tiktokLiveConnection.on('chat', data => {
      let out = {
        nickname: data.nickname,
        msgContent: data.comment,
        profilePictureUrl: data.profilePictureUrl
      }
      res.write({
        event: "incomingChat",
        data: JSON.stringify(out)
      })
      console.log(out)
    })
  }

}
app.post('/connect', connectToLive);
app.get('/chatStream', chatStream)