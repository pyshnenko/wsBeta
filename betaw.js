require('dotenv').config();
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
const PORT = process.env.PORT;
const nodemailer = require('nodemailer');

const MongoClient = require("mongodb").MongoClient;
const url = "spamigor.ru:27017";
const username = encodeURIComponent(process.env.MONGOLOGIN);
const password = encodeURIComponent(process.env.MONGOPASS);
const authMechanism = "DEFAULT";
const uri =`mongodb://${username}:${password}@${url}/?authMechanism=${authMechanism}`;
const mongoClient = new MongoClient(uri);
const db = mongoClient.db("loggerBeta");
const collection = db.collection("log");

let testEmailAccount = nodemailer.createTestAccount();

const redis = new Redis({
  port: 6379,
  host: process.env.IP,
  password: process.env.REDISPASS
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
let users = [];  
let history = readN();

let options = {
	key: fs.readFileSync("/etc/letsencrypt/live/spamigor.ru/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/spamigor.ru/fullchain.pem"),
	ca: fs.readFileSync("/etc/letsencrypt/live/spamigor.ru/chain.pem")
};

let transporter = nodemailer.createTransport({
  host: 'smtp.mail.ru',
  port: 465,
  secure: true,
  key: options.key,
  cert: options.sert,
  ca: options.ca,
  auth: {
    user: 'mazepaspam@mail.ru',
    pass: '18nK7ijCnMbv3wbKu0e6',
  },
});

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
	console.log(request.rawHeaders[3])
  response.redirect(request.rawHeaders[3]==='control.spamigor.ru'?'https://control.spamigor.ru':`https://spamigor.ru:${PORT}`);
});

app.get("/", async function(request, response){
    console.log(Object.keys(request));
    console.log(request.rawHeaders[3])
	if (request.cookies.token != undefined ) {
		const value = await redis.get(request.cookies.token);
		if (value == null )	response.render("generalT.hbs", {
			regWindow: true, 
			userData: false, 
			date1: date[0], 
			date2: date[1], 
			date3: date[2], 
			date4: date[3], 
			date5: date[4], 
			date6: date[5], 
			date7: date[6]
		});
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
		response.render("generalT.hbs", {
			regWindow: true, 
			userData: false, 
			date1: date[0], 
			date2: date[1], 
			date3: date[2], 
			date4: date[3], 
			date5: date[4], 
			date6: date[5], 
			date7: date[6]
		});
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
				for (let i=0; i<history.length; i++)
					connection.sendUTF(`hi: ${history[i]}`);
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
				if ((bufDat === 'restart')&&(connectPi)) clients.sendUTF('restart');
				if ((bufDat === 'gitPull')&&(connectPi)) clients.sendUTF('gitPull');
				if ((bufDat === 'gitPush')&&(connectPi)) clients.sendUTF('gitPush');
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
						users[i].sendUTF(`we: ${(new Date()).toLocaleString()} - connect`);
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
						users[i].sendUTF(`no: ${(new Date()).toLocaleString()} - connect`);
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
						users[i].sendUTF(`wi: ${(new Date()).toLocaleString()} - connect`);
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
						users[i].sendUTF(`s1: ${(new Date()).toLocaleString()} - connect`);
					}
				}
			}
			else if (bufAddr === 's2') {
				console.log('site 4014 connected');
				bufDat = message.utf8Data.substr(4);
				date[5] = new Date(Number(bufDat));
				site4013 = connection;
				site4013Con = true;
				if (userConnected) {
					for (let i=0; i<users.length; i++) {
						users[i].sendUTF(`date: ${JSON.stringify(date)}`);
						users[i].sendUTF(`s2: ${(new Date()).toLocaleString()} - connect`);
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
						users[i].sendUTF(`s3: ${(new Date()).toLocaleString()} - connect`);
					}
				}
			}
			else if (bufAddr === 'TM') {
				console.log('tecnical message');
				let subAddr = message.utf8Data.substr(4,2);
				switch(subAddr) {
					case 'pi': {subAddr = 'raspberry: '; break}
					case 'st': {subAddr = 'raspberry: '; break}
					case 'we': {subAddr = 'weather bot: '; break}
					case 'no': {subAddr = 'note bot: '; break}
					case 'wi': {subAddr = 'wish bot: '; break}
					case 's1': {subAddr = '4011: '; break}
					case 's2': {subAddr = '4014: '; break}
					case 's3': {subAddr = '4014/1587: '; break}
				}
				bufDat = message.utf8Data.substr(8);
				console.log(`TM: ${subAddr}${bufDat}`);
				historyAdd(`${(new Date()).toLocaleString()} - ${subAddr}${bufDat}`);
				if (userConnected) {
					for (let i=0; i<users.length; i++) {
						users[i].sendUTF(`TM: ${(new Date()).toLocaleString()} - ${subAddr}${bufDat}`);
					}
				}
			}
        }
    });
    connection.on('close', function(reasonCode, description) {
		if (connection == clients) {
			console.log('bot disconnected');
			connectPi = false;
			setTimeout(() => {
				if (!connectPi) {
					transporter.sendMail({
						from: '<mazepaspam@mail.ru>',
						to: 'pyshnenko94@yandex.ru',
						subject: 'Потеряна связь с сервером',
						text: `Потеряна связь с домашним сервером в ${(new Date()).toString()}.`,
						html:
						`Потеряна связь с домашним сервером в ${(new Date()).toString()}. <a href="https://spamigor.ru:8080">статус</a>`,
					});
				}
			}, 30*1000);
			for (let i=0; i<users.length; i++) {
				users[i].sendUTF('st: disconnect');
				users[i].sendUTF(`TM: st: ${(new Date()).toLocaleString()} - disconnect`);
				historyAdd(`st: ${(new Date()).toLocaleString()} - disconnect`);
			}
		}
		else if (users.includes(connection)) {
			console.log('user disconnected');
			users.splice(users.indexOf(connection),1);
			if (users.length == 0) userConnected = false;
		}
		else if (connection == weather) {
			console.log('weather disconnected');
			weatherCon = false;
			for (let i=0; i<users.length; i++) {
            	users[i].sendUTF('we: disconnect');
				users[i].sendUTF(`TM: we: ${(new Date()).toLocaleString()} - disconnect`);
				historyAdd(`we: ${(new Date()).toLocaleString()} - disconnect`);
			}
		}
		else if (connection == note) {
			console.log('note disconnected');
			noteCon = false;
			for (let i=0; i<users.length; i++) {
            	users[i].sendUTF('no: disconnect');
				users[i].sendUTF(`TM: no: ${(new Date()).toLocaleString()} - disconnect`);
				historyAdd(`no: ${(new Date()).toLocaleString()} - disconnect`);
			}
		}
		else if (connection == wish) {
			console.log('wish disconnected');
			wishCon = false;
			for (let i=0; i<users.length; i++) {
            	users[i].sendUTF('wi: disconnect');
				users[i].sendUTF(`TM: wi: ${(new Date()).toLocaleString()} - disconnect`);
				historyAdd(`wi: ${(new Date()).toLocaleString()} - disconnect`);
			}
		}
		else if (connection == site4011) {
			console.log('site 4011 disconnected');
			site4011Con = false;
			for (let i=0; i<users.length; i++) {
            	users[i].sendUTF('s1: disconnect');
				users[i].sendUTF(`TM: s1: ${(new Date()).toLocaleString()} - disconnect`);
				historyAdd(`s1: ${(new Date()).toLocaleString()} - disconnect`);
			}
		}
		else if (connection == site4013) {
			console.log('site 4013 disconnected');
			site4013Con = false;
			for (let i=0; i<users.length; i++) {
            	users[i].sendUTF('s2: disconnect');
				users[i].sendUTF(`s2: we: ${(new Date()).toLocaleString()} - disconnect`);
				historyAdd(`s2: ${(new Date()).toLocaleString()} - disconnect`);
			}
			console.log('site 4013/1587 disconnected');
			site40131587Con = false;
			for (let i=0; i<users.length; i++) {
				users.sendUTF('s3: disconnect');
				users[i].sendUTF(`TM: s3: ${(new Date()).toLocaleString()} - disconnect`);
				historyAdd(`s3: ${(new Date()).toLocaleString()} - disconnect`);
			}
		}
        else console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});


server.listen(PORT, () => {
	console.log(`serever is runing at port ${PORT}`);
});

async function historyAdd(buf) {
	try {
		await mongoClient.connect()
		let data = {text: buf};
		let result = await collection.insertOne(data);
		console.log(result);
		let bufResult = await collection.find().toArray();
		while (bufResult.length>200)
		{
			let id = await bufResult[0]._id;
			await collection.deleteOne({_id: id});
			bufResult = await collection.find().toArray();
		}
		history = bufResult.map((buffer) => { return buffer.text });
	}
	catch(e) {
		console.log('mongodb error: ' + e);
	}	
	finally {
		await mongoClient.close();
	}
}

async function readN() {
	let result;
	try {
		await mongoClient.connect();
		result = await collection.find().toArray();
		console.log(result);
	}
	catch (e) {console.log('read err: ' + e);}
	finally { await mongoClient.close(); }
	let exitData = result.map((realData) => {return realData.text})
	return exitData;
}
