const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const assert = require('assert');
const fs = require('fs');
const formidable = require('formidable');
const mongourl = '';
const dbName = '381project';
const SECRETKEY = 'iamkey1';

app.set('view engine','ejs');

app.use(session({
    name: 'session',
    keys: [SECRETKEY]
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const insertDocument = (db, collection, doc, callback) => {
    db.collection(collection).
    insertOne(doc, (err, result) => {
        assert.equal(err,null);
        console.log("inserted one document " + JSON.stringify(doc));
        callback(result);
    });
}

const findDocument = (db, collection, criteria, callback) => {
    let cursor = db.collection(collection).find(criteria);
    console.log(`findDocument: ${JSON.stringify(criteria)}`);
    cursor.toArray((err,docs) => {
        assert.equal(err,null);
        console.log(`findDocument: ${docs.length}`);
        callback(docs);
    });
}

const deleteDocument = (db, collection, criteria, callback) => {
    db.collection(collection).
    deleteOne(criteria, (err, result) => {
        assert.equal(err,null);
    	console.log("deleted one document " + JSON.stringify(criteria));
        callback(result);
    });
}

const updateDocument = (collection, criteria, updateDoc, callback) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

         db.collection(collection).updateOne(criteria,
            {
                $set : updateDoc
            },
            (err, results) => {
                client.close();
                assert.equal(err, null);
                callback(results);
            }
        );
    });
}

app.get('/', (req,res) => {
    if (req.session.user) {
	res.redirect('/read');
    }else {
	res.redirect('/login');
    }
});

app.get('/login', (req,res) => {
    if (req.session.user) {
	res.redirect('/read');
    }else {
	res.status(200).render('login');
    }
});

app.post('/login', (req,res) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);
        findDocument(db, 'account', req.body, (docs) => {
            client.close();
            console.log("Closed DB connection");
            console.log(docs);
	    if (docs.length > 0) {
		req.session.user = req.body.userid;
		res.redirect('/');
	    }else {
	    	res.redirect('/');
	    }
        });
    });
});

app.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

app.get('/register', (req, res) => {
    if (req.session.user) {
	res.redirect('/');
    }else {
	res.status(200).render('register');
    }
});

app.post('/register', (req, res) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
    	console.log("Connected successfully to server");
    	const db = client.db(dbName);

	if (req.body.password != req.body.confirmPw) {
	    res.status(200).render('info',{message: 'Confirm password is different with password!'});
	}else {
	    var findAccount = {};
	    findAccount['userid'] = req.body.userid;
	    findDocument(db, 'account', findAccount, (docs) => {
            	console.log("Closed DB connection");
           	console.log(docs);
	    	if (docs.length > 0) {
		    client.close();
		    res.status(200).render('info',{message: 'The user ID already exist!'});
	    	}else {
	    	    var addAccount = {};
	    	    addAccount['userid'] = req.body.userid;
	            addAccount['password'] = req.body.password;
    	            insertDocument(db, 'account', addAccount, (results) => {
	    		client.close();
	    		console.log("Closed DB connection");
	    		res.status(200).render('info',{message: 'Account is created!'});
	    	    })
	        }
            });
	}
    });
});

app.all('/read', (req,res) => {
    if (req.session.user) {
	const client = new MongoClient(mongourl);
    	client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

	    var criteria = {};
	    if (req.body.criteria) {
		var criteria = {};
	    	criteria[req.body.searchBy] = req.body.criteria;
	    }

            findDocument(db, 'restaurant', criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).render('read',{nRestaurants: docs.length, restaurants: docs, userid: req.session.user});
            });
        });
    }else {
	res.redirect('/');
    }
});

app.get('/search', (req,res) => {
   if (req.session.user) {
	const client = new MongoClient(mongourl);
    	client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, 'restaurant', req.query.docs, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).render('read',{nRestaurants: docs.length, restaurants: docs, userid: req.session.user});
            });
        });
    }else {
	res.redirect('/');
    }
});

app.get('/create', (req,res) => {
    if (req.session.user) {
	res.status(200).render('create');
    }else {
	res.redirect('/');
    }
});

app.post('/create', (req,res) => {
    if (req.session.user) {
	const client = new MongoClient(mongourl);
    	client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);
	    const form = formidable({ multiples: true });
 
            form.parse(req, (err, fields, files) => {
	    	var address = {};
    	    	var insertDoc = {};
    	    	insertDoc['name'] = fields.name;
    	    	insertDoc['borough'] = fields.borough;
	    	insertDoc['cuisine'] = fields.cuisine;
    	    	address['street'] = fields.street;
	    	address['building'] = fields.building;
    	    	address['zipcode'] = fields.zipcode;
	    	address['coord'] = [parseFloat(fields.coordLon), parseFloat(fields.coordLat)];
	    	insertDoc['address'] = address;
	    	insertDoc['owner'] = req.session.user;
		insertDoc['grades'] = [];
    	    	if (files.imagetoupload.size > 0) {
            	    fs.readFile(files.imagetoupload.path, (err,data) => {
                        assert.equal(err,null);
                        insertDoc['photo'] = new Buffer.from(data).toString('base64');
		        insertDoc['mimetype'] = files.imagetoupload.type;
		        insertDocument(db, 'restaurant', insertDoc, (results) => {
                            res.status(200).render('info', {message: `Inserted ${results.insertedCount} document`})
                        });
                    });
    	        }else {
		    insertDoc['photo'] = "";
		    insertDoc['mimetype'] = "";
                    insertDocument(db, 'restaurant', insertDoc, (results) => {
		        console.log(results);
                        res.status(200).render('info', {message: `Inserted ${results.insertedCount} document`})
                    });
                }
            });
	});
    }else {
	res.redirect('/');
    }
});

app.get('/display', (req,res) => {
    if (req.session.user) {
	const client = new MongoClient(mongourl);
    	client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            let DOCID = {};
            DOCID['_id'] = ObjectID(req.query._id);
            findDocument(db, 'restaurant', DOCID, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).render('details', {restaurant: docs[0]});
            });
        });
    }else {
	res.redirect('/');
    }
});

app.get('/rmap', (req,res) => {
    res.status(200).render('leaflet', 
	{lat:req.query.lat, lon:req.query.lon, zoom: 15});
    res.end();
});

app.get('/delete', (req,res) => {
    if (req.session.user) {
	const client = new MongoClient(mongourl);
    	client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            let DOCID = {};
            DOCID['_id'] = ObjectID(req.query._id)
            let cursor = db.collection('restaurant').find(DOCID);
            cursor.toArray((err,docs) => {
                assert.equal(err,null);
	        console.log(docs)
	        if (req.session.user == docs[0].owner) {
		    deleteDocument(db, 'restaurant', DOCID, (docs) => {
                    	client.close();
                    	console.log("Closed DB connection");
                    	res.status(200).render('info',{message: 'Deleted successfully!'});
            	    });
	        }else {
		    client.close();
		    res.status(200).render('info',{message: 'You are not authorized to delete!'});
	        }
            });
        });
    }else {
	res.redirect('/');
    }
});

app.get('/edit', (req,res) => {
    if (req.session.user) {
	const client = new MongoClient(mongourl);
    	client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            let DOCID = {};
            DOCID['_id'] = ObjectID(req.query._id)
            let cursor = db.collection('restaurant').find(DOCID);
            cursor.toArray((err,docs) => {
                client.close();
                assert.equal(err,null);
	        console.log(docs)
	        if (req.session.user == docs[0].owner) {
		    res.status(200).render('edit',{restaurant: docs[0]});
	        }else {
		    res.status(200).render('info',{message: 'You are not authorized to edit!'});
	        }
            });
        });
    }else {
	res.redirect('/');
    }
});

app.post('/update', (req,res) => {
    const form = formidable({ multiples: true });
 
    form.parse(req, (err, fields, files) => {
        var DOCID = {};
	var address = {}
    	DOCID['_id'] = ObjectID(fields._id);
    	var updateDoc = {};
    	updateDoc['name'] = fields.name;
    	updateDoc['borough'] = fields.borough;
	updateDoc['cuisine'] = fields.cuisine;
    	address['street'] = fields.street;
	address['building'] = fields.building;
    	address['zipcode'] = fields.zipcode;
	address['coord'] = [parseFloat(fields.coordLon), parseFloat(fields.coordLat)];
	updateDoc['address'] = address;
    	if (files.imagetoupload.size > 0) {
            fs.readFile(files.imagetoupload.path, (err,data) => {
                assert.equal(err,null);
                updateDoc['photo'] = new Buffer.from(data).toString('base64');
		updateDoc['mimetype'] = files.imagetoupload.type;
                updateDocument('restaurant', DOCID, updateDoc, (results) => {
                    res.status(200).render('info', {message: `Updated ${results.result.nModified} document(s)`})
                });
            });
    	} else {
            updateDocument('restaurant', DOCID, updateDoc, (results) => {
                res.status(200).render('info', {message: `Updated ${results.result.nModified} document(s)`})
            });
        }
    });
});

app.get('/rate', (req, res) => {
   if (req.session.user) {
	res.status(200).render('rate', {_id: req.query._id});
    }else {
	res.redirect('/');
    }
});

app.post('/rate', (req,res) => {
    if (req.session.user) {
	const client = new MongoClient(mongourl);
    	client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            let DOCID = {};
            DOCID['_id'] = ObjectID(req.body._id)
            let cursor = db.collection('restaurant').find(DOCID);
            cursor.toArray((err,docs) => {
                client.close();
                assert.equal(err,null);
		var canRate = true;
		for (var i = 0; i < docs[0].grades.length; i++) {
		    if (req.session.user == docs[0].grades[i].user) {
			canRate = false;
			break;
		    }
		}
	        if (canRate == true) {
		    var updateDoc = {};
		    var rating = {};
		    var oriRating = docs[0].grades
		    rating['user'] = req.session.user;
		    rating['score'] = parseInt(req.body.score);
		    oriRating.push(rating);
		    updateDoc['grades'] = oriRating;
		    updateDocument('restaurant', DOCID, updateDoc, (results) => {
                	res.status(200).render('info',{message: 'Rate successfully!'});
                    });
	        }else {
		    res.status(200).render('info',{message: 'You already rated!'});
	        }
            });
        });
    }else {
	res.redirect('/');
    }
});

app.get('/api/restaurant/:searchBy/:criteria', (req,res) => {
    var searchBy = req.params.searchBy;
    if (searchBy != 'name' && searchBy != 'borough' && searchBy != 'cuisine') {
	res.status(404).render('info', {message: `${req.path} - Unknown request!`});
	res.end();
    }else {
	var criteria = {}
    	criteria[req.params.searchBy] = req.params.criteria;

    	const client = new MongoClient(mongourl);
    	client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, 'restaurant', criteria, (docs) => {
            	client.close();
            	console.log("Closed DB connection");
            	res.status(200).json(docs);
	    	res.end();
            });
    	});
    }
});

app.get('/*', (req,res) => {
    res.status(404).render('info', {message: `${req.path} - Unknown request!`});
});

app.listen(app.listen(process.env.PORT || 8099));
