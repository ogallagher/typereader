/*
server.js
Owen Gallagher
9 April 2020

Serves typereader, a keystroke dynamics authentication program.

*/

try {
	const fs = require('fs')
	const express = require('express')

	require('dotenv').config()

	const app = express()

	app.set('port', (process.env.PORT || 55555))
	const port = app.get('port')

	app.use(
		process.env.BASE_PATH || '/',
		express.static('public', {
			index: 'typereader.html'
		})
	)

	const os = require('os')
	var wifi = os.networkInterfaces().en0;
	var ip = '127.0.0.1'

	if (wifi) {
		for (var key of Object.keys(wifi)) {
			var info = wifi[key]
	
			//ipv4 and nonloopback
			if (info.family == 'IPv4' && info.internal == false) {
				ip = info.address
				break
			}
		}
	}

	let users = {}
	fs.readFile('./users.json', function(err, data) { 
		if (err) {
			console.log('no registered users yet')
		}
		else {
		    users = JSON.parse(data); 
	    	
			for (let key of Object.keys(users)) {
				let user = users[key]
				
				console.log(user.username + ': ')
				for (let stroke_name of Object.keys(user.signature)) {
					let stroke_time = user.signature[stroke_name]
					console.log('\t' + stroke_name + '=(' + stroke_time.time + stroke_time.deviation + ')')
				}
			}
		}
	}); 

	// send current users
	app.get(`${process.env.BASE_PATH || ''}/users`, function(req,res) {
		console.log('sending users list')
		res.send(users)
	})

	// handle new user
	app.get(`${process.env.BASE_PATH || ''}/newuser`, function(req,res) {
		var user = req.query
		console.log('adding new user')
		console.log(user)
	
		users[user.username] = user
	
		fs.writeFile('./users.json', JSON.stringify(users), function(err) {
			if (err) {
				console.log(err)
			}
			else {
				console.log('done')
				res.send('good')
			}
		})
	})

	//listen for client connections
	app.listen(port, function() {
		console.log('Testing server is running at ' + ip + ':' + port)
	})
}
catch (err) {
	console.log(err)
	console.log('make sure you run npm install to download the node dependencies first')
}