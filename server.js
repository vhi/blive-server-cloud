var express		= require('express');
var app			= express();
var session 	= require('express-session');
var request 	= require('request');

app.use(express.static('public'));
app.set('view engine', 'ejs');
// Session
// app.use(session({ secret: 'keyboard cat', cookie: { maxAge: 60000 }}));
app.use(session({ secret: 'keyboard cat' }));

/* body-parser */
var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

/* JsonDB */
var JsonDB 			= require('node-json-db');
var dbController 	= new JsonDB("dbController", true, false);
var dbUsers 		= new JsonDB("dbUsers", true, false);
var dbRaspberryId	= new JsonDB("dbRaspberryId", true, false);
var dbRaspberryKey;

/* CHECK IF USER IS LOGIN */
function checkLogin(req, res, next) {
	if (req.session.email) {
		next();
	} else {
		res.redirect('/login');
	}
}

app.get('/', function(req, res) {
	res.redirect('/home');
});

app.get('/home', checkLogin, function(req, res) {
	res.render('pages/home');
});

// Login fron mobile
app.get('/loginFromMobile/:email/:password', function(req, res) {
	try {
		userData = dbUsers.getData("/" + req.params.email);
		if (userData.password == req.params.password) {
			res.send({userId : userData.raspberryID, username : userData.fullName});
		} else {
			res.send(null);	
		}
	} catch (error) {
		res.send(null);
	}
});

app.get('/controller', checkLogin, function(req, res) {
	try {
		controllerData = dbRaspberryKey.getData("/controller");
	} catch (error) {
		console.log('Error Occured');
		controllerData = {};
	}
	res.render('pages/controller', { data : controllerData });
});

app.get('/room', checkLogin, function(req, res) {
	try {
		roomData = dbRaspberryKey.getData("/room");
	} catch (error) {
		console.log('Error Occured');
		roomData = {};
	}
	res.render('pages/room', { data : roomData });
});

app.get('/zone', checkLogin, function(req, res) {
	// Try to get /zone data
	try { zoneData = dbRaspberryKey.getData("/zone"); } 
	catch (error) { zoneData = {}; }
	// // Try to get /controller data
	try { controllerData = dbRaspberryKey.getData("/controller"); } 
	catch (error) { controllerData = {}; }
	// // Try to get /room data
	try { roomData = dbRaspberryKey.getData("/room"); } 
	catch (error) { roomData = {}; }

	res.render('pages/zone', { data : zoneData, roomData : roomData, controllerData : controllerData });
});

app.get('/account', checkLogin, function(req, res) {
	res.render('pages/account', {
		raspberryID : req.session.raspberryID,
		userEmail	: req.session.email,
		userName	: req.session.fullName
	});
});

app.get('/login', function(req, res) {
	res.render('pages/login');
});

app.post('/action/login', function(req, res) {
	var post = req.body;
	try {
		userData = dbUsers.getData("/" + post.email);
		if (userData.password == post.password) {
			req.session.email 		= post.email;
			req.session.raspberryID = userData.raspberryID;
			req.session.fullName	= userData.fullName;
			dbRaspberryToLoad 		= new JsonDB('raspiKey_' + req.params.rasperryKey, true, false);
		}
		dbRaspberryKey = new JsonDB('raspiKey_' + req.session.raspberryID, true, false);
	} catch (error) {
	    console.error(error);
	}
	res.redirect('/');
});

app.get('/signup', function(req, res) {
	res.render('pages/signup');
});

app.post('/action/signup', function(req, res) {
	var post 	= req.body;
	objData 	= { fullName : post.fullName, raspberryID : post.raspberryID, password : post.password };
	dbUsers.push("/" + post.email, objData, false);
	dbRaspberryId.push("/" + post.raspberryID, post.email, false);
	res.redirect('/');
});

app.get('/logout', function(req, res) {
	req.session.destroy(function(){
      console.log("user logged out.");
   });
   res.redirect('/');
});

app.get('/add-form', function(req, res) {
	res.render('pages/add');
});

app.get('/count/:idToken', function(req, res) {
	controllerData = db.getData("/controller/" + req.params.idToken);
	res.render('pages/controller_list', {
		dataLength : Object.keys(controllerData).length,
		datas : controllerData
	});
});

/* CONTROLLER CRUD */
app.get('/addController/:name/:type/:ip', checkLogin, function(req, res) {
	objData = {name : req.params.name, type : req.params.type, ip : req.params.ip};
	dbRaspberryKey.push("/controller/" + Date.now(), objData, false);
	res.send(dbRaspberryKey);
});

app.get('/editController/:id/:name/:type/:ip', checkLogin, function(req, res) {
	objData = {name : req.params.name, type : req.params.type, ip : req.params.ip};
	dbRaspberryKey.push("/controller/" + req.params.id, objData, false);
	res.send(dbRaspberryKey);
});

app.get('/removeController/:idController', checkLogin, function(req, res) {
	dbRaspberryKey.delete("/controller/" + req.params.idController);
	res.send("okay");
});

/* ROOM CRUD */
app.get('/addRoom/:name', checkLogin, function(req, res) {
	idGenerated = Date.now();
	objData = { id : idGenerated, name : req.params.name };
	dbRaspberryKey.push("/room/" + idGenerated, objData, false);
	res.send(dbRaspberryKey);
});

app.get('/editRoom/:id/:name', checkLogin, function(req, res) {
	objData = { id : idGenerated, name : req.params.name };
	dbRaspberryKey.push("/room/" + req.params.id, objData, false);
	res.send(dbRaspberryKey);
});

app.get('/removeRoom/:idRoom', checkLogin, function(req, res) {
	dbRaspberryKey.delete("/room/" + req.params.idRoom);
	res.send("okay");
});

/* ZONE CRUD */
app.get('/addZone/:name/:roomName/:controllerName/:deviceType/:isRf/:command', function(req, res) {
	objData = { name 			: req.params.name, 
				roomName 		: req.params.roomName, 
				controllerName 	: req.params.controllerName,
				sort			: req.params.deviceType,
				rf 				: req.params.isRf,
				command			: req.params.command.replace("-", "/"),
				status			: 'off',
				status_from		: 'home'
			};
	//res.send(objData)
	dbRaspberryKey.push("/zone/" + Date.now(), objData, false);
	res.send(dbRaspberryKey);
});

app.get('/editZone/:id/:name/:roomName/:controllerName/:deviceType/:command', function(req, res) {
	objData = { name 			: req.params.name, 
				roomName 		: req.params.roomName, 
				controllerName 	: req.params.controllerName,
				sort		    : req.params.deviceType,
				rf 				: false,
				command			: req.params.command,
				status			: 'off',
				status_from		: 'home'
			};
	dbRaspberryKey.push("/zone/" + req.params.id, objData, false);
	res.send(dbRaspberryKey);
});

app.get('/removeZone/:idZone', checkLogin, function(req, res) {
	dbRaspberryKey.delete("/zone/" + req.params.idZone);
	res.send("okay");
});

/* Load JSON data */
app.get('/load/controller', function(req, res) {
	var data = dbRaspberryKey.getData("/");
	res.send(data);
});

app.get('/load/user', function(req, res) {
	var data = dbUsers.getData("/");
	res.send(data);
});

app.get('/load/raspberry', function(req, res) {
	var data = dbRaspberryId.getData("/");
	res.send(data);
});

//untuk disediakan ke mobile
app.get('/load/allData/:rasperryKey', function(req, res) {
	dbRaspberryToLoad 	= new JsonDB('raspiKey_' + req.params.rasperryKey, true, false);
	var datane 			= [];
	var dataZone		= dbRaspberryToLoad.getData("/zone");
	var jsonData		= {};
	for (x in dataZone) {
		try {
			roomId 					= dbRaspberryToLoad.getData("/room/" + dataZone[x].roomName).id;
			roomName 				= dbRaspberryToLoad.getData("/room/" + dataZone[x].roomName).name;

			dataZone[x].zoneId		= x;
			dataZone[x].roomName 	= roomName;
			
			delete dataZone[x].controllerName;
			delete dataZone[x].command;
			
			datane.push(dataZone[x]);
		} catch(error) {
			// Do something...
		}
	}

	jsonData.devices = datane;
	
	res.send(jsonData);
});

//untuk nembak server raspberry (controlling device)
app.get('/load/allData2/:rasperryKey', function(req, res) {
	dbRaspberryToLoad 	= new JsonDB('raspiKey_' + req.params.rasperryKey, true, false);
	var datane 			= [];
	var dataZone		= dbRaspberryToLoad.getData("/zone");
	var jsonData		= {};
	for (x in dataZone) {
		try {
			roomId 					= dbRaspberryToLoad.getData("/room/" + dataZone[x].roomName).id;
			roomName 				= dbRaspberryToLoad.getData("/room/" + dataZone[x].roomName).name;

			ipAddress				= dbRaspberryToLoad.getData("/controller/" + dataZone[x].controllerName).ip;
			dataZone[x].zoneId		= x;
			dataZone[x].ipAddress	= ipAddress;

			delete dataZone[x].name;
			delete dataZone[x].roomName;
			delete dataZone[x].controllerName;
			// delete dataZone[x].sort;

			datane.push(dataZone[x]);
		} catch(error) {

		}
	}

	res.send(datane);
});

//untuk nembak cloud (ambil json)
app.get('/load/jsonForRaspberry/:rasperryKey', function(req, res) {
	dbRaspberryToLoad = new JsonDB('raspiKey_' + req.params.rasperryKey, true, false);
	//console.log(dbRaspberryToLoad);
	data			  = dbRaspberryToLoad.getData("/");
	res.send(data);
});

//save to json at cloud from raspberry server
app.post('/saveFromRaspberry/:raspberryKey', function(req, res) {
	post 		= req.body;
	fsCobaValue = require('fs');
	cobaValue 	= fsCobaValue.createWriteStream('raspiKey_' + req.params.raspberryKey + '.json', {flags: 'w'});
	cobaValue.write(post.foo);
	res.send('');
});

/* Delete JSON data */
app.get('/del/controller', function(req, res) {
	var data = dbRaspberryKey.delete("/");
	res.send();
});

app.get('/execute/:rpiId/:zoneId/:commandVal', function(req, res) {

	try {

		request('http://' + req.headers.host + '/load/allData2/' + req.params.rpiId, function(err, response, body) {
			try {
				data = JSON.parse(body);
				for ( x in data ) {
					if (data[x].zoneId == req.params.zoneId) {
						zoneId = data[x].zoneId;

						dbRaspberryKey = new JsonDB('raspiKey_' + req.params.rpiId, true, false);

						// IF RF device is true
						if (data[x].rf == 'false') {
							switch (data[x].sort) {
								case 'ac' :
									// 1 = ON, 5 = OFF
									if (req.params.commandVal == 5) { 
										dbRaspberryKey.push("/zone/" + zoneId, {status : "off"}, false); 
									}
									else if (req.params.commandVal == 1) { 
										dbRaspberryKey.push("/zone/" + zoneId, {status : "on"}, false); 
									}
									break;
								case 'light' :
									// 0 = OFF, 1 - 100 = ON
									if (req.params.commandVal == 0) { 
										dbRaspberryKey.push("/zone/" + zoneId, {status : "off"}, false); 
									}
									else { 
										dbRaspberryKey.push("/zone/" + zoneId, {dim_level : req.params.commandVal}, false);
										dbRaspberryKey.push("/zone/" + zoneId, {status : "on"}, false); 
									}
									break;
								case 'sg' :
									// 0 = OFF, 1 - 100 = ON
									if (req.params.commandVal == 0) { 
										dbRaspberryKey.push("/zone/" + zoneId, {status : "off"}, false); 
									}
									else { 
										dbRaspberryKey.push("/zone/" + zoneId, {status : "on"}, false); 
									}
									break;
								case 'fan' :
									// 0 = OFF, 1 - 100 = ON
									if (req.params.commandVal == 0) { 
										dbRaspberryKey.push("/zone/" + zoneId, {status : "off"}, false); 
									}
									else { 
										dbRaspberryKey.push("/zone/" + zoneId, {status : "on"}, false); 
									}
									break;
								default :
									break;
							}
							dbRaspberryKey.push("/zone/" + zoneId, {status_from : "away"}, false);
							// if (true) {
							// 	if (req.params.commandVal == 100) { dbRaspberryKey.push("/zone/" + zoneId, {status : "on"}, false); }
							// 	else { dbRaspberryKey.push("/zone/" + zoneId, {status : "off"}, false); }
							// }

							//urlnya = 'http://' + 
							//	 data[x].ipAddress + '/' + 
							//	 data[x].command + '/?value=' +
							//	 req.params.commandVal;

							// request(urlnya, function(err, response, body) {});

							//res.send(urlnya);

						} else {
							command 		= data[x].command;
							command 	    = command.split(',');
							command 		= command[req.params.commandVal];

							if (req.params.commandVal == 0) { dbRaspberryKey.push("/zone/" + zoneId, {status : "off"}, false); }
							if (req.params.commandVal == 1) { dbRaspberryKey.push("/zone/" + zoneId, {status : "on"}, false); }

							var fsFrValue 	= require('fs');
							var frValue 	= fsFrValue.createWriteStream('frValue.txt', {flags: 'w'});
							frValue.write(command);

							res.send('RF!');
						}

					}
					
				}
			} catch (error) {
				res.send('error occured2');
			}
		});

	} catch (error) {
		res.send('error occured');
	}

});

/* Listening Port */
app.listen(777, function() {
	console.log('listen to 777');
});