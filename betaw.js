const fs = require("fs");
const express = require("express");
const hbs = require("hbs");
const bcrypt = require('bcrypt');
const Redis = require('ioredis');
const app = express();
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const urlencodedParser = express.urlencoded({extended: true});
const PORT = 8080;
const redis = new Redis({
  port: 6379,
  host: "45.89.66.91",
  password: "ugD6s2xz"
});
const WebSocketServer = require('websocket').server;
const https = require('https');

let salt;
redis.get("salt").then((res) => salt = res);

let date = [];
let connectPi = false;
let rebTrig = true;
let userConnected = false;
let noteCon = false;
let wishCon = false;
let weatherCon = false;
let site4011Con = false;
let site4013Con = false;
let site40131587Con = false;

let note;
let site4011;
let site4013;
let site40131587;
let wish;
let weather;
let clients; //pi
let users = [];  //тут бы массив сделать

let options = {
	key: fs.readFileSync("/etc/letsencrypt/live/spamigor.site/privkey.pem"),//("/home/spamigor/node/certHttps/key.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/spamigor.site/fullchain.pem"),//("/home/spamigor/node/certHttps/cert.pem"),
	ca: fs.readFileSync("/etc/letsencrypt/live/spamigor.site/chain.pem")
};

let test = 'no data';

app.use(cookieParser('secret key'));
app.set("view engine", "hbs");
hbs.registerPartials(__dirname + "/views");

app.use(function(req, res, next){
	if (req.secure) {
		next();
	} else if ((req.headers['x-forwarded-proto'] || '').substring(0, 5) === 'https') {
		next();
	} else if (req.method === 'GET' || req.method === 'HEAD') {
		const host = req.headers['x-forwarded-host'] || req.headers.host;
		res.redirect(301, 'https://${host}${req.originalUrl}');
	} else {
		res.status(403).send('This server requires an HTTPS connection.');
	}
});

app.post("/", urlencodedParser, async function (request, response) {
	console.log(request.body.keyReg);
	console.log('im here');
    if(!request.body) return response.sendStatus(200);
	let userHash;
	await bcrypt.hash((request.body.userPass+request.body.userName.trim()), salt).then(function(res) {
		console.log(res);
		userHash = res.substr(7);
	});
	const valueP = await redis.get(userHash);
	console.log(`valueP: ${valueP}`);
	if (valueP == request.body.userName.trim()) {
		console.log('valueP=name');
		await response.cookie('token', userHash,{
			maxAge: (3600 * 24 * 30 * 1000),
		});			
	}	
	response.redirect('https://spamigor.site:'+PORT);
});

app.get("/", async function(request, response){
	/*let subbuf = (connectPi ? '<font color="#00FF00"><h2>Бот активен</h2></font>' : '<font color="#FF0000"><h2>Бот не активен</h2></font>');
	let buf = `<h2>Привет user!</h2>\n${subbuf}\n<h2>обновлено: ${date}</h2>`;
	response.send(buf);*/
	if (request.cookies.token != undefined ) {
		const value = await redis.get(request.cookies.token);
		if (value == null )	response.render("generalT.hbs", {regWindow: true, userData: false, date1: date[0], date2: date[1], date3: date[2], date4: date[3], date5: date[4], date6: date[5], date7: date[6]});
		else response.render("generalT.hbs", {
			regWindow: false,
			userData: true,
			userLogin: value,
			userToken: request.cookies.token, 
			date1: date[0], 
			date2: date[1], 
			date3: date[2], 
			date4: date[3], 
			date5: date[4], 
			date6: date[5], 
			date7: date[6]
		});
	}
	else {
		response.render("generalT.hbs", {regWindow: true, userData: false, date1: date[0], date2: date[1], date3: date[2], date4: date[3], date5: date[4], date6: date[5], date7: date[6]});
	}
});

app.get("/favicon.ico", function(request, response){
	response.sendFile(__dirname + "/favicon.ico");
});

app.get("/style.css", function(request, response){
	response.sendFile(__dirname + "/style.css");
}); 

let server = https.createServer(options, app);

wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

wsServer.on('request', function(request) {    
    let connection = request.accept('echo-protocol', request.origin);
    console.log((new Date()) + ' Connection accepted.');
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data);
			let buf = message.utf8Data;
			let bufDat, bufAddr = message.utf8Data.substr(0,2);
			if (bufAddr === 'ng') connection.sendUTF('ressived');
			else if (bufAddr === 'pi') {
				bufDat = message.utf8Data.substr(4);
				console.log(bufDat);
				date[0] = new Date(Number(bufDat));
				if (userConnected) 
					for (let i=0; i<users.length; i++) 
						users[i].sendUTF(`date: ${JSON.stringify(date)}`);
				clients=connection;
				connectPi = true;
				if (userConnected)
					for (let i=0; i<users.length; i++)  
						users[i].sendUTF('st: connect');
			}
			else if (bufAddr === 'us') {
				console.log('user connected');
				console.log(buf);
				bufDat = message.utf8Data.substr(4);
				if (users.indexOf(connection) == (-1)) users.push(connection);
				userConnected = true;
				for (let i=0; i<users.length; i++) {
					users[i].sendUTF(`date: ${JSON.stringify(date)}`);
					users[i].sendUTF(connectPi ? 'st: connect' : 'st: disconnect');
					users[i].sendUTF(weatherCon ? 'we: connect' : 'we: disconnect');
					users[i].sendUTF(noteCon ? 'no: connect' : 'no: disconnect');
					users[i].sendUTF(wishCon ? 'wi: connect' : 'wi: disconnect');
					users[i].sendUTF(site4011Con ? 's1: connect' : 's1: disconnect');
					users[i].sendUTF(site4013Con ? 's2: connect' : 's2: disconnect');
					users[i].sendUTF(site40131587Con ? 's3: connect' : 's3: disconnect');
				}
				if ((bufDat === 'reboot')&&(connectPi)) clients.sendUTF('reboot');
			}
			else if (bufAddr === 'we') {
				console.log('weather bot connected');
				bufDat = message.utf8Data.substr(4);
				date[1] = new Date(Number(bufDat));
				weather = connection;
				weatherCon = true;
				if (userConnected) {
					for (let i=0; i<users.length; i++) {
						users[i].sendUTF(`date: ${JSON.stringify(date)}`);
						users[i].sendUTF('we: connect');
					}
				}
			}
			else if (bufAddr === 'no') {
				console.log('note bot connected');
				bufDat = message.utf8Data.substr(4);
				date[2] = new Date(Number(bufDat));
				note = connection;
				noteCon = true;
				if (userConnected) {
					for (let i=0; i<users.length; i++) {
						users[i].sendUTF(`date: ${JSON.stringify(date)}`);
						users[i].sendUTF('no: connect');
					}
				}
			}
			else if (bufAddr === 'wi') {
				console.log('wish bot connected');
				bufDat = message.utf8Data.substr(4);
				date[3] = new Date(Number(bufDat));
				wish = connection;
				wishCon = true;
				if (userConnected) {
					for (let i=0; i<users.length; i++) {
						users[i].sendUTF(`date: ${JSON.stringify(date)}`);
						users[i].sendUTF('wi: connect');
					}
				}
			}
			else if (bufAddr === 's1') {
				console.log('site 4011 connected');
				bufDat = message.utf8Data.substr(4);
				date[4] = new Date(Number(bufDat));
				site4011 = connection;
				site4011Con = true;
				if (userConnected) {
					for (let i=0; i<users.length; i++) {
						users[i].sendUTF(`date: ${JSON.stringify(date)}`);
						users[i].sendUTF('s1: connect');
					}
				}
			}
			else if (bufAddr === 's2') {
				console.log('site 4013 connected');
				bufDat = message.utf8Data.substr(4);
				date[5] = new Date(Number(bufDat));
				site4013 = connection;
				site4013Con = true;
				if (userConnected) {
					for (let i=0; i<users.length; i++) {
						users[i].sendUTF(`date: ${JSON.stringify(date)}`);
						users[i].sendUTF('s2: connect');
					}
				}
			}
			else if (bufAddr === 's3') {
				console.log('site 4013/1587 connected');
				bufDat = message.utf8Data.substr(4);
				date[6] = new Date(Number(bufDat));
				site40131587 = connection;
				site40131587Con = true;
				if (userConnected) {
					for (let i=0; i<users.length; i++) {
						users[i].sendUTF(`date: ${JSON.stringify(date)}`);
						users[i].sendUTF('s3: connect');
					}
				}
			}
            //connection.sendUTF(message.utf8Data);
        }
    });
    connection.on('close', function(reasonCode, description) {
		if (connection == clients) {
			console.log('bot disconnected');
			connectPi = false;
			for (let i=0; i<users.length; i++)
				users[i].sendUTF('st: disconnect');
		}
		else if (users.includes(connection)) {
			console.log('user disconnected');
			users.splice(users.indexOf(connection),1);
			if (users.length == 0) userConnected = false;
		}
		else if (connection == weather) {
			console.log('weather disconnected');
			weatherCon = false;
			for (let i=0; i<users.length; i++)
            	users[i].sendUTF('we: disconnect');
		}
		else if (connection == note) {
			console.log('note disconnected');
			noteCon = false;
			for (let i=0; i<users.length; i++)
            	users[i].sendUTF('no: disconnect');
		}
		else if (connection == wish) {
			console.log('wish disconnected');
			wishCon = false;
			for (let i=0; i<users.length; i++)
            	users[i].sendUTF('wi: disconnect');
		}
		else if (connection == site4011) {
			console.log('site 4011 disconnected');
			site4011Con = false;
			for (let i=0; i<users.length; i++)
            	users[i].sendUTF('s1: disconnect');
		}
		else if (connection == site4013) {
			console.log('site 4013 disconnected');
			site4013Con = false;
			for (let i=0; i<users.length; i++)
            	users[i].sendUTF('s2: disconnect');
			console.log('site 4013/1587 disconnected');
			site40131587Con = false;
			for (let i=0; i<users.length; i++)
				users.sendUTF('s3: disconnect');
		}
        else console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});


server.listen(PORT, () => {
	console.log(`serever is runing at port ${PORT}`);
});