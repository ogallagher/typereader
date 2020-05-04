let typereader
let directions
let input_container
let input
let login
let register
let data
let buttons
let cancel_buttons
let cancel

const FAV_WORDS = 15				//how many favorite words from which to pick best features (I pick 15)
const FEATURE_SAMPLE_SIZE = 5		//how many measurements are in a feature sample (I pick 5)
const SIGNATURE_SIZE = 10			//how many features are in a keystroke_signature (I pick 10)

const STATE_START = 0
const STATE_REGISTER = 10
const STATE_TRAIN = 11
const STATE_REGISTER_SUCCESS = 12
const STATE_LOGIN = 20
const STATE_LOGIN_RESULT = 21
const STATE_NO_USER = 23

const directions_messages = {
	select: 'Input a username. Whitespace is not allowed.<br>\
			 To register as a new user, hit the <strong>register</strong> button.<br>\
			 To login as an existing user, hit the <strong>login</strong> button.',
	
	register: 'Hello, <strong>[username]</strong>.<br>\
			   Start creating your keystroke signature by typing ' + FAV_WORDS + ' of your favorite usernames or words.',
	
	login: 'Hello, <strong>[username]</strong>.<br>\
			Validate by typing words that contain the following <strong>character pairs</strong>\
		 	(hit <strong>ENTER</strong> after each).',
	
	not_registered: '<strong>[username]</strong> is not a registered account.<br>\
					 Did you mean to register as a new user?',
	
	train: 'To finish creating your keystroke signature, type things that contain each <strong>character pair</strong>.<br>\
			For example, if the prompt is <strong>W3</strong>, then some valid entries would be <strong>W33kend</strong>, <strong>aW3some</strong>, and <strong>move_W3st</strong>',
	
	register_success: 'User <strong>[username]</strong> was successfully added! Hit the <strong>login</strong>\
					   button to try authenticating.',
	
	login_result: 'Logging in as <strong>[username]</strong>, your anomaly score is <strong>[difference]</strong>.<br>\
				   A lower anomaly score suggests that you are the correct user. A higher score suggests you are\
				   an imposter.'
}

const input_placeholders = {
	username: 'username',
	fav_word: 'a word, any word'
}

const input_valids = /^([a-zA-Z0-9!@#$%^&*()-_+=\[\]{}\\|;:'\",<.>/?~`]|shift|alt)$/

const input_controls = [
	'control',
	'meta'
]

const input_resets = [
	'backspace',
	'delete'
]

let state = STATE_START

let username = ''

let users = {}

let register_step = 0
let features = []
let current_feature = null
let signature = null
let current_feature_key = null
let feature_keys = null
let train_step = 0

let attempt = null
let login_difference = 0

$(document).ready(function() {
	directions = $('#directions')

	input_container = $('#input-container')
	input = $('#input')
	input.keydown(input_key_handler)
	
	login = $('#login')
	login.click(do_login)
	
	register = $('#register')
	register.click(do_register)
	
	buttons = $('#buttons')
	
	cancel = $('#cancel')
	cancel.click(do_cancel)
	
	cancel_buttons = $('#cancel-buttons')
	
	data = $('#data')
	
	get_users()
		
	update_state(STATE_START)
})

function update_state(new_state) {
	state = new_state
	
	switch (state) {
		case STATE_START:
			features = []
			current_feature = null
			register_step = 0
			train_step = 0
			
			cancel_buttons.hide()
			buttons.show()
			directions.html(directions_messages.select)
			input.attr('placeholder',input_placeholders.username)
			break
			
		case STATE_REGISTER:
			buttons.hide()
			cancel_buttons.show()
			data.html('')
			
			directions.html(directions_messages.register.replace('[username]',username))
			input.attr('placeholder',input_placeholders.fav_word)
			
			signature = new keystroke_signature()
			break
			
		case STATE_LOGIN:
			buttons.hide()
			cancel_buttons.show()
			data.html('')
		
			directions.html(directions_messages.login.replace('[username]',username))
			
			input.attr('placeholder',current_feature_key)
			break
			
		case STATE_TRAIN:
			data.html('<p class="legible">' + username + ' signature:</p>' + signature.string())
			
			directions.html(directions_messages.train)
			
			current_feature = null
			train_next_feature(true)
			break
			
		case STATE_REGISTER_SUCCESS:
			directions.html(directions_messages.register_success.replace('[username]',username))
			
			input.val(username)
			input.attr('placeholder',input_placeholders.username)
			buttons.show()
			cancel_buttons.hide()
			
			signature.finalize()
			send_new_user()
			
			data.html('<p class="legible">New signature:<br><strong>' + signature.string() + '</strong></p>')
			break
			
		case STATE_NO_USER:
			directions.html(directions_messages.not_registered.replace('[username]',username))
			data.html('<p class="legible">username = ' + username + '</p>')
			break
			
		case STATE_LOGIN_RESULT:
			input.val('')
			input.attr('placeholder',input_placeholders.username)
			
			buttons.show()
			cancel_buttons.hide()
			
			directions.html(
				directions_messages.login_result
					.replace('[difference]',login_difference)
					.replace('[username]',username))
				
			get_users()
				
			data.html('')
			
			break
	}
}

function input_key_handler(e) {
	let k = e.key.toLowerCase()
	
	if (k.match(input_valids)) {
		if (state == STATE_REGISTER || state == STATE_TRAIN || state == STATE_LOGIN) {
			if (current_feature != null) {
				//next feature
				let new_feature = current_feature.finish(k)
				features.push(current_feature)
				current_feature = new_feature
			}
			else {
				//first feature
				current_feature = new feature(k, Date.now())
			}
		}
		
		data.html(data.html() + ' ' + k)
	}
	else if (input_controls.indexOf(k) != -1) {
		//allow control keys, but don't use for features
		data.html(data.html() + ' !')
	}
	else if (input_resets.indexOf(k) != -1) {
		//clear input
		input.val('')
		
		if (state == STATE_TRAIN) {
			data.html('<p class="legible">Training progress: ' + 
					  (signature.training_progress(SIGNATURE_SIZE,FEATURE_SAMPLE_SIZE) * 100).toFixed(2) + 
					  '%</p>')
		}
		else {
			data.html('')
		}
		
		features = []
		current_feature = null
	}
	else if (k == 'enter') {
		if (state == STATE_START) {
			username = input.val()
			data.html('<p class="legible">username = ' + username + '</p>')
			input.val('')
		}
		else if (state == STATE_REGISTER) {
			let word = input.val()
			
			if (word != '') {
				register_step++
				
				//update signature
				signature.add_features(features)
				
				//reset features
				current_feature = null
				features = []
				
				//move to training phase
				if (register_step >= FAV_WORDS) {
					//pick best features for training stage
					if (signature.reduce_features(SIGNATURE_SIZE)) {
						update_state(STATE_TRAIN)
					}
					else {
						data.html('<p class="legible">Not enough keystroke information was provided in the\
								   given entry samples to move on to the training stage. Keep trying more\
								   words until this message goes away.</p>')
					}
				}
				else {
					//print features data
					data.html('<p class="legible">' + register_step + '. ' + word + '</p>')
				}
			}
			
			input.val('')
		}
		else if (state == STATE_LOGIN) {
			input.val('')
			data.html('')
			
			//add features to attempt
			attempt.add_features(features)
			features = []
			current_feature = null
			
			//get next needed feature
			current_feature_key = attempt.next_feature()
			if (current_feature_key != null) {
				//prompt for next feature
				input.attr('placeholder',current_feature_key)
			}
			else {
				//authenticate against signature
				login_difference = signature.authenticate(attempt.features)
				update_state(STATE_LOGIN_RESULT)
			}
		}
		else if (state == STATE_TRAIN) {
			let word = input.val()
			
			if (word != '') {
				//update current feature sample
				signature.train_features(features)
				
				current_feature = null
				features = []
				
				if (signature.trained(current_feature_key,FEATURE_SAMPLE_SIZE)) {
					//move to next feature
					train_next_feature()
				}
				else {
					input.attr('placeholder',current_feature_key)
					data.html('<p class="legible">Training progress: ' + 
							  (signature.training_progress(SIGNATURE_SIZE,FEATURE_SAMPLE_SIZE) * 100).toFixed(2) + '%</p>')
				}
			}
			else {
				data.html('<p class="legible">Training progress: ' + 
						  (signature.training_progress(SIGNATURE_SIZE,FEATURE_SAMPLE_SIZE) * 100).toFixed(2) + 
						  '%</p>')
			}
			
			input.val('')
		}
	}
	else {
		data.html(data.html() + ' !')
		return false
	}
}

function do_login(e) {
	let text = input.val()
	if (text != '') {
		username = text
	}
	
	if (username != '') {
		input.val('')
		
		let user = users[username]
		if (user != null) {
			feature_keys = Object.keys(user.signature)
			current_feature_key = feature_keys[0]
			
			attempt = new keystroke_login(feature_keys)
			signature = new keystroke_signature(user.signature)
			
			update_state(STATE_LOGIN)
		}
		else {
			update_state(STATE_NO_USER)
		}
	}
}

function do_register(e) {
	let text = input.val()
	if (text != '') {
		username = text
	}
	
	if (username != '') {
		input.val('')
		update_state(STATE_REGISTER)
	}
}

function do_cancel(e) {
	username = ''
	input.val('')
	update_state(STATE_START)
}

function get_users() {
	$.get({
		url: '/users',
		success: function(data) {
			users = data
			console.log(users)
			
			let users_list = $('#users-list').html('')
			for (let user of Object.keys(users)) {
				users_list.append($('<li>' + user + '</li>'))
			}
		},
		error: function(err) {
			data.html('<p class="legible">ERROR: unable to get users list from server</p>')
			console.log(err)
		}
	})
}

function send_new_user() {
	$.get({
		url: '/newuser',
		data: {
			username: username,
			signature: signature.features
		},
		error: function(err) {
			data.html('<p class="legible"><strong>ERROR: </strong> failed to register new user <strong>' + username + '</strong></p>')
		},
		success: function(data) {
			console.log('new user registration success')
		}
	})
	
	get_users()
}

function train_next_feature(reset) {
	if (feature_keys == null || reset) {
		train_step = 0
		feature_keys = Object.keys(signature.feature_samples)
	}
	
	let kn = feature_keys.length
	
	current_feature_key = feature_keys[train_step]
	train_step++
	
	while (train_step <= kn && signature.trained(current_feature_key,FEATURE_SAMPLE_SIZE)) {
		current_feature_key = feature_keys[train_step]
		train_step++
	}
	
	if (train_step > kn) {
		update_state(STATE_REGISTER_SUCCESS)
	}
	
	input.attr('placeholder',current_feature_key)
	data.html('<p class="legible">Training progress: ' + 
			  (signature.training_progress(kn,FEATURE_SAMPLE_SIZE) * 100).toFixed(2) + 
			  '%</p>')
}

function feature(k,t) {
	this.start_time = t
	this.start_key = k
}

feature.prototype.finish = function(k) {
	let t = Date.now()
	this.time = t - this.start_time
	this.keys = this.start_key + k	
	
	return new feature(k, t)
}

feature.prototype.string = function() {
	return '[' + this.keys + '=' + this.time + ']'
}

function keystroke_signature(stored_signature) {
	this.num_entries = 0
	this.feature_samples = {}
	this.features = {}
	
	if (stored_signature != null) {
		this.features = stored_signature
	}
}

/*
add fs=(features array for new entry) to keystroke_signature.feature_samples
*/
keystroke_signature.prototype.add_features = function(fs) {
	let feature_sample = null
	for (let f of fs) {
		//add feature to feature samples
		feature_sample = this.feature_samples[f.keys]
		
		if (feature_sample == null) {
			//create new sample set
			this.feature_samples[f.keys] = {
				keys: f.keys,
				times: [f.time]
			}
		}
		else {
			//add to existing sample set
			feature_sample.times.push(f.time)
		}
	}
	this.num_entries++
}

/*
keep n=(number of features in a signature) best features in the signature
to be further sampled
*/
keystroke_signature.prototype.reduce_features = function(n) {
	//array of feature sample sizes and feature samples
	let fns = []
	
	//keys names of removed features
	let removed = []
	
	for (let feature_sample_name of Object.keys(this.feature_samples)) {
		let feature_sample = this.feature_samples[feature_sample_name]
		let fn = feature_sample.times.length
				
		let m = fns.length;
		let found_spot = false
		
		//insert
		for (let i=0; i<m && !found_spot; i++) {
			if (fn > fns[i].fn) {
				fns.splice(i,0,{
					fn: fn,
					fs: feature_sample
				})
									
				found_spot = true
			}
		}
		
		//add to back
		if (!found_spot) {
			fns.push({
				fn: fn,
				fs: feature_sample
			})
		}
		
		//reduce
		if (m+1 > n) {
			//remove last feature with lowest fn
			removed.push(fns.pop().fs.keys)
		}
	}
	
	if (fns.length == n) {
		//update feature_samples
		for (let key of removed) {
			delete this.feature_samples[key]
		}
	
		return true
	}
	else {
		//not enough features for reduction
		return false
	}
}

keystroke_signature.prototype.train_features = function(new_features) {
	for (let f of new_features) {
		let feature_sample = this.feature_samples[f.keys]
		
		if (feature_sample != null) {
			//add new training time
			feature_sample.times.push(f.time)			
		}
	}
}

keystroke_signature.prototype.trained = function(keys,n) {
	return (this.feature_samples[keys].times.length >= n)
}

keystroke_signature.prototype.finalize = function() {
	this.features = {}
	
	for (let feature_name of Object.keys(this.feature_samples)) {
		let feature_sample = this.feature_samples[feature_name]
		
		//calculate mean and standard deviation per feature
		let tn = feature_sample.times.length
		let mean = 0
		
		for (let t of feature_sample.times) {
			mean += t
		}
		mean /= tn
		
		let standard_deviation = 0
		for (let t of feature_sample.times) {
			standard_deviation += (t-mean)*(t-mean)
		}
		standard_deviation = Math.sqrt(standard_deviation / tn)
		
		//add final feature to signature.features
		this.features[feature_name] = {
			keys: feature_name,
			time: mean,
			deviation: standard_deviation
		}
	}
}

keystroke_signature.prototype.authenticate = function(test) {	
	let scaled_manhattan = 0
	let n = 0
	
	for (let test_feature_name of Object.keys(test)) {
		let test_feature = test[test_feature_name]
		let feature = this.features[test_feature.keys]
		
		let diff = Math.abs(test_feature.time - parseFloat(feature.time)) //raw dist
		
		diff /= parseFloat(feature.deviation) //scaled dist
		
		//update manhattan dist. NOTE: this is my own addition and not part of the original scaled manhattan algorithm
		scaled_manhattan += diff
		n++
	}
	
	//normalize for number of features
	scaled_manhattan /= n
	
	return scaled_manhattan
}

keystroke_signature.prototype.raw_string = function() {
	let str = ''
	
	for (let feature_name of Object.keys(this.feature_samples)) {
		let feature_sample = this.feature_samples[feature_name]
		
		str += '[' + feature_name + '] '
		for (let time of feature_sample.times) {
			str += time + ' '
		}
		str += '\n'
	}
	
	return str
}

keystroke_signature.prototype.string = function() {
	let str = ''
	
	for (let feature_name of Object.keys(this.features)) {
		let feature = this.features[feature_name]
		
		str += feature_name + '=' + feature.time + ',' + feature.deviation + ' '
	}
	
	console.log(str)
	
	return str
}

/*
n = number of features in signature
fn = number of measures in feature sample
*/
keystroke_signature.prototype.training_progress = function(n, fn) {
	let p = 0
	
	for (let feature_name of Object.keys(this.feature_samples)) {
		let t = this.feature_samples[feature_name].times.length
		
		if (t <= fn) {
			p += t
		}
		else {
			p += fn
		}
	}
	
	return p / (n * fn)
}

function keystroke_login(feature_keys) {
	this.features = {}
	
	for (let fk of feature_keys) {
		this.features[fk] = {
			keys: fk,
			time: null
		}
	}
}

keystroke_login.prototype.add_features = function(features) {
	for (let f of features) {
		let feature_name = f.keys
		let feature = this.features[feature_name]
		
		if (feature != null) {
			feature.time = f.time
			console.log(feature_name + ' = ' + feature.time)
		}
	}
}

keystroke_login.prototype.next_feature = function() {	
	for (let feature_name of Object.keys(this.features)) {
		if (this.features[feature_name].time == null) {
			return feature_name
		}
	}
	
	return null
}