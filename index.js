/*---------------------------------*\
| Latest changes by Tru3Codes       |
\*---------------------------------*/

const fs = require('fs');
const app = require('express')();
const ejs = require("ejs");
const sha256 = require("sha256");
const socket = require("socket.io");
const cookie = require("cookie");
const cookieParser = require("cookie-parser");

// JSON Functions
function loadjson(name) {
  var json = JSON.parse(fs.readFileSync(name));
  return json;
}

function savejson(name, data) {
  fs.writeFileSync(name, data);
}

// Dict Pop Function
function pop(object, propertyName) {
  let temp = object;
  delete temp[propertyName];
  return temp;
}

/*---------------*\
| Express.JS Code |
\*---------------*/
app.get("/", (req, res) => {
  if (!(req.headers.cookie)) {
    req.headers.cookie = {};
  }
  var cookies = cookie.parse(req.headers.cookie.toString());
  var accounts = loadjson('passwords.json');
  if (cookies.username && cookies.password) {
    if (cookies.username in accounts) {
      if (accounts[cookies.username] === sha256(cookies.password)) {
        res.render("html/game");
      } else {
        res.render("html/index");
      }
    } else {
      res.render("html/index");
    }
  } else {
    res.render("html/index");
  }
});

app.get("/leaderboard", (req, res) => {
  res.render('html/leaderboard');
});

app.get("/info", (req, res) => {
  res.render('html/info');
});

// app.get("/v2", (req, res) => {
//   res.render('html/gameV2');
// });

app.get("/api/users", (req, res) => {
  res.send(loadjson('userdata.json'));
});

app.engine("html", ejs.renderFile);
app.set('view engine', "html");
app.set('views', __dirname + '/public');

app.use(cookieParser());
app.use(require("express").static(__dirname + "/public"));

const server = app.listen(8080, () => {
  console.log('Started server.');
});

/*--------------*\
| Socket.IO Code |
\*--------------*/
const io = socket(server);

io.on('connection', (socket) => {
  console.log("A user connected - "+ socket.id);
	
  function resetalldata() {
    var userdata = loadjson('userdata.json');
    for (const [key, value] of Object.entries(userdata)) {
      userdata[key] = {"money": 0, "mpc": 1, "mps": 0, "acb": 0, "ecb": 0};
    }
    savejson('userdata.json', JSON.stringify(userdata));
  }

  function changereset() {
    var date = new Date();
    var hours = ((date.getHours()-24)*-1)-1;
    var minutes = ((date.getMinutes()-60)*-1)-1;
    var seconds = ((date.getSeconds()-60)*-1)-1;

    if (hours.toString().length === 1) {
      hours = '0'+hours.toString();
    }

    if (minutes.toString().length === 1) {
      minutes = '0'+minutes.toString();
    }

    if (seconds.toString().length === 1) {
      seconds = '0'+seconds.toString();
    }

    if (seconds === '00' && minutes === '00' && hours === '01') {
      resetalldata();
      io.emit('refresh');
    }

    return `Daily reset in ${hours}:${minutes}:${seconds}`;
  }

  setInterval(function(){
    io.emit('displayreset', changereset());
    // var userdata = loadjson('userdata.json');
    // var password = loadjson('passwords.json');
    // for (const [key, value] of Object.entries(userdata)) {
    //   if (userdata[key].money.toString().includes("e")) {
    //     delete userdata[key];
    //     delete password[key];
    //   }
    // }
    // savejson('userdata.json', userdata);
    // savejson('passwords.json', password)
  }, 100);

  socket.on('checkhomedata', (data) => {
    var accounts = loadjson('passwords.json');
    if (data) {
      if (data.username in accounts) { 
        if (accounts[data.username] === sha256(data.password)) {
          io.to(socket.id).emit('initiateaccount');
        } else {
          io.to(socket.id).emit('homeerror', "Password is incorrect or this username is not available for signup.");
        }
      } else {
        accounts[data.username] = sha256(data.password);
        savejson('passwords.json', JSON.stringify(accounts));
        var userdata = loadjson('userdata.json');
        userdata[data.username] = {"money": 0, "mpc": 1, "mps": 0, "acb": 0, "ecb": 0};
        savejson('userdata.json', JSON.stringify(userdata));
        io.to(socket.id).emit('initiateaccount')
      }
    } else {
      io.to(socket.id).emit('homeerror', "Uh oh! Something went wrong! Try again later.");
    }
  });

  socket.on('changedata', (data) => {
		/*
    	mpc = money per click
    	mps = money per second (autoclick)
    	acb = autoclick buyer
    	ecb = extraclick buyer
		*/
    var userdata = loadjson('userdata.json');
    userdata[data.username] = pop(data, "username");
    savejson('userdata.json', JSON.stringify(userdata));
  });

  socket.on('getdata1', (data) => {
    var userdata = loadjson('userdata.json');
    io.to(socket.id).emit('returndata1', userdata[data.username]);
  });

  socket.on('getdata2', () => {
    var userdata = loadjson('userdata.json');
    io.to(socket.id).emit('returndata2', userdata);
  });

  socket.on('ban', (data) => {
    var passwords = loadjson('passwords.json');
    delete passwords[data.username]
    savejson('passwords.json', JSON.stringify(passwords));

    var userdata = loadjson('userdata.json');
    delete userdata[data.username]
    savejson('userdata.json', JSON.stringify(userdata));
    io.to(socket.id).emit('refresh')
  });

	socket.on('disconnect', () => {
    console.log('A user disconnected - ' + socket.id);
  });
});
