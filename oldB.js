const fs = require("fs");
var WebSocketServer = require('websocket').server;
var https = require('https');
var date;
let connectPi = false;
let rebTrig = true;

let clients;

let options = {
	key: fs.readFileSync("/etc/letsencrypt/live/spamigor.ru/privkey.pem"),//("/home/spamigor/node/certHttps/key.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/spamigor.ru/fullchain.pem"),//("/home/spamigor/node/certHttps/cert.pem"),
	ca: fs.readFileSync("/etc/letsencrypt/live/spamigor.ru/chain.pem")
};

var server = https.createServer(options, function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    //response.writeHead(200);
	if((request.url === "/")||(request.url === "/home")) {
		response.setHeader("Content-Type", "text/html; charset=utf-8;");
		response.write("<!DOCTYPE html>");
		response.write("<html>");
		response.write('<h2>Hello</h2>');
		response.write(connectPi ? '<font color="#00FF00"><h3>Бот активен</h3></font>' : '<font color="#FF0000"><h3>Бот не активен</h3></font>');
		response.write(`<h3>последнее время активности: ${date}</h3>`);
		response.write(`<a href="reboot"><button>REBOOT</button></a>`);
		response.write("</html>");
		response.end();
	}
    else if(request.url === "/reboot"){
		let send=false;
		if ((clients != undefined)&&(connectPi)&&(rebTrig)) {
			clients.sendUTF('reboot');
			rebTrig = false;
			send = true;
			setTimeout(() => { rebTrig=true; }, 60*1000);
		}
		response.setHeader("Content-Type", "text/html; charset=utf-8;");
		response.write("<!DOCTYPE html>");
		response.write("<html>");
        response.write(send ? "<h2>Команда на перезагрузку отправлена</h2>" : "<h2>Перезагрузка отклонена</h2>");
		response.write(`<a href="home"><button>НАЗАД</button></a>`);
		response.write("</html>");
		response.end();
        //response.statusCode = 302;
        //response.setHeader("Location", "/home");
    }
	else {
		response.writeHead(404);
		response.write("<h2>Not found</h2>");
		response.end();
	}
});
server.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
});

wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }
    
    var connection = request.accept('echo-protocol', request.origin);
    console.log((new Date()) + ' Connection accepted.');
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data);
			let buf = message.utf8Data;
			let bufDat, bufAddr = message.utf8Data.substr(0,2);
			if (bufAddr === 'pi') {
				bufDat = message.utf8Data.substr(4);
				console.log(bufDat);
				date = new Date(Number(bufDat));
				clients=connection;
				connectPi = true;
			}
            //connection.sendUTF(message.utf8Data);
        }
        else if (message.type === 'binary') {
            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
            connection.sendBytes(message.binaryData);
        }
    });
    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
		connectPi = false;
    });
});