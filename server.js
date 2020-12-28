const express = require('express');
const app = express();
const session = require('cookie-session');
const fileUpload= require('express-fileupload');
//const formidable = require('express-formidable');
const fs = require('fs');
const mongo = require('mongodb');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const assert = require('assert');
const { isNull } = require('util');
const bodyParser = require('body-parser');
const { Console } = require('console');
const { query } = require('express');
const { render } = require('ejs');
const mongourl = 'mongodb://admin:admin@localhost:27017/restaurant';
const dbName = 'restaurant';
const secretKey = 'secret';

app.set('view engine', 'ejs');
app.use(fileUpload());
app.use(session({name: 'loginSession', keys:[secretKey]}));
app.use(express.static('public'));
// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded());

// Parse JSON bodies (as sent by API clients)
app.use(express.json());
//app.use(formidable());
app.use(function(req, res, next) {
    res.locals.user = req.session.user;
    next();
});

const loginHandler = (req, res, query) =>{
    var userName = query.uname;
        var PW = query.pw;
        console.log('name: '+ userName+'/nPassword: '+PW);
        //res.status(404).render('client', {message: 'name: '+ userName+'/nPassword: '+PW });
    const client = new MongoClient(mongourl);

    try{
        client.connect((err) =>{
            assert.equal(null,err);
            //console.log("Connected successfully to server");
            const db = client.db(dbName);
            
            let cursor = db.collection('identity').findOne(
                {name: userName, password: PW},
                (err, results) => {
                    console.log("result: "+results);
                    if(!results){
                        res.status(200).render('login', {message: 'Invalid username or password. Please try again.'});
                    }else{
                        req.session.user = results;
                        console.log("session: "+req.session);
                        res.status(200).render('client', {message: 'Login Success! Welcome '+userName});
                    }
                });
        });
    }catch(e){
        console.log("entered catch");
        res.status(200).render('login', {message: 'Invalid username or password. Please try again.'});
    }finally{
        client.close();
    }
}

const searchHandler = (req, res, query) =>{
    var rname = query.name;
    var rcusine = query.cusine;
    var rborough=query.borough;
    console.log('name: '+ rname+'/nCusine: '+rcusine+'\nBorough: '+rborough);
    const client = new MongoClient(mongourl);
    var mquery={};
    if(rname)mquery.name=new RegExp(rname,"i");
    if(rcusine)mquery.cusine=new RegExp(rcusine,"i");
    if(rborough)mquery.borough=new RegExp(rborough,"i");
    console.log(mquery);
    try{
        client.connect((err) =>{
            assert.equal(null,err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);
            
            let cursor = db.collection('restaurants').find(mquery).toArray().then((data)=>{
                console.log(data);
                if(data.length>0)
                    res.status(200).render('search', {message: 'Search result shown as below :',results:data});
                else
                    res.status(200).render('search', {message: 'No restaurant matched the criteria. Please try again.',results:[]});
            });
        });
    }catch(e){
        console.log("entered catch");
        res.status(200).render('search', {message: 'No restaurant matched the criteria. Please try again.',results:[]});
    }finally{
        client.close();
    }
}

const registerHandler = (req, res, query) =>{
    var userName = query.uname;
        var PW = query.pw;
        console.log('name: '+ userName+'/nPassword: '+PW);
    const client = new MongoClient(mongourl);

    try{
        client.connect((err) =>{
            assert.equal(null,err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            let cursor = db.collection('identity').find({name:userName}).toArray().then((data)=>{
                console.log(data);
                if (data.length==0&&userName!=null){ 
                    db.collection('identity').insertOne({name: userName, password: PW});
                    res.status(200).render('client', {message: 'Registered. Welcome '+userName});
                }
                else
                    res.status(200).render('register', {message: 'User name already exisits or invalid. Please try again.'});
            });
        });
    }catch(e){
        res.status(200).render('register', {message: 'User name already exisits. Please try again.'});
    }finally{
        client.close();
    }
};

const RateButtonHandler = (req, res, query)=>{
    var restaurantid=new mongo.ObjectID(req.session.restaurant);
    req.session.restaurant=null;
    var id = new mongo.ObjectID(req.session.user._id);
    var rating=query.rate;
    console.log("restaurant: "+restaurantid);
    const client=new MongoClient(mongourl);
    try{
        client.connect((err) =>{
            assert.equal(null,err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);
            
            db.collection('ratingRecord').insert({user: id, restaurant: restaurantid,  rate:rating}).then((data) =>{
                console.log(data);
                if(data){
                    res.status(200).render('client', {message: "Your rating has been recorded."});
                }else{
                    res.status(404).render('client', {message: `${req.path} - Unknown request!` });
                }
            });
        });
    }catch(e){
        res.status(404).render('client', {message: `${req.path} - Unknown request!` });
    }finally{
        client.close();
    }
};

const rateHandler = (req, res, query)=>{
    const client = new MongoClient(mongourl);
    console.log("restaurant id: "+query.restaurant);
    req.session.restaurant=query.restaurant;
    var restaurantid= new mongo.ObjectID(query.restaurant);
    var uid=new mongo.ObjectID(req.session.user._id);
    try{
        client.connect((err) =>{
            assert.equal(null,err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            db.collection('restaurants').findOne({_id:restaurantid}).then((data)=>{
                console.log("restaurant: "+data.name);
                var restaurantName=data.name;
                db.collection('ratingRecord').findOne({restaurant:restaurantid,user:uid}).then((found)=>{
                    console.log("user: "+req.session.user.name);
                    db.collection('ratingRecord').find({restaurant:restaurantid}).toArray().then((data)=>{
                        console.log(data);
                            if(data.length){
                            var avg=0;
                            for(var i=0;i<data.length;i++){
                                avg+=Number(data[i].rate);
                            }
                            console.log("total: "+avg);
                            avg/=data.length;
                            avg=avg.toFixed(2);
                            console.log("avg: "+avg);
                            res.status(200).render('rate',{restaurantname:restaurantName,rating:avg,rated:!!found});
                        }else{
                            res.status(200).render('rate',{restaurantname:restaurantName,rating:null,rated:!!found});
                        }
                    });
                });
            });
            //res.status(404).render('client', {message: `${req.path} - Unknown request!` });
        });
    }catch(e){
        console.log("err: "+e);
        res.status(404).render('client', {message: `${req.path} - Unknown request!` });

    }finally{
        client.close();
    }
};

const showDocHandler = (req, res, query)=>{
    const client = new MongoClient(mongourl);
    console.log("restaurant id: "+query.restaurant);
    req.session.restaurant=query.restaurant;
    var restaurantid= new mongo.ObjectID(query.restaurant);
    var uid=new mongo.ObjectID(req.session.user._id);
    try{
        client.connect((err) =>{
            assert.equal(null,err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            db.collection('restaurants').findOne({_id:restaurantid}).then((data)=>{
                console.log("restaurant: "+data.name);
                var restaurantName=data.name;
                var restaurantBor=data.borough;
                var restaurantCui=data.cuisine;
                var restaurantSt=data.address.street;
                var restaurantbld=data.address.building;
                var restaurantzip=data.address.zipcode;
                var restaurantcoord=data.address.coord;
                
                db.collection('restaurants').findOne({restaurant:restaurantid,user:uid,}).then((found)=>{
                    console.log("user: "+req.session.user.name);
                    res.status(200).render('display',{title:restaurantName,borough:restaurantBor,cuisine:restaurantCui, street:restaurantSt,building:restaurantbld,zipcode:restaurantzip,coord:restaurantzip});
                });
            });
        });
    }catch(e){
        console.log("err: "+e);
        res.status(404).render('client', {message: `${req.path} - Unknown request!` });

    }finally{
        client.close();
    }
};



const createHandler = (req, res, query) =>{
    var restname = query.rname;
    var Borough = query.borough;
    var Cuisine = query.cuisine;
    var Street = query.street;
    var Building = query.building;
    var Zip = query.zip;
    var Coord = query.coord;
    var Score = query.score;
    //var Owner = req.session.userID;
    const client = new MongoClient(mongourl);

    try{
        client.connect((err) =>{
            assert.equal(null,err);

            console.log("Connected successfully to server");
            const db = client.db(dbName);

            let cursor = db.collection('restaurants').find({name:restname}).toArray().then((data)=>{
                console.log(data);

                if (data.length==0&&restname!=null){ 
                    db.collection('restaurants').insertOne({name: restname, borough: Borough, cuisine: Cuisine, address: {street: Street, building: Building, zipcode: Zip, coord: Coord},grades: {score: Score}/*, owner:Owner*/});
                    res.status(200).render('display', {title:restname, borough: Borough, cuisine: Cuisine, street:Street, building: Building, zipcode:Zip, coord: Coord,score: Score});
                }
                else
                    res.status(200).render('create', {message: 'Name and owner are mandatory. Please try again.'});
            });
        });
    }catch(e){
		res.status(200).render('create', {message: 'User name already exisits. Please try again.'});

    }finally{
        client.close();
    }
};

const showDetailssHander = (req, res, query)=>{
    var restaurantid=new mongo.ObjectID(req.session.restaurant);
    req.session.restaurant=null;
    var id = new mongo.ObjectID(req.session.user._id);
    var rating=query.rate;
    console.log("restaurant: "+restaurantid);
    const client=new MongoClient(mongourl);
}

const getUpload=(req,res)=>{
    req.session.restaurant=req.query.restaurant;
    var restaurantid=new mongo.ObjectID(req.query.restaurant);
    var photo=null, mimetype=null, isOwner=true;
    console.log("restaurant: "+restaurantid);
    const client=new MongoClient(mongourl);
    try{
        client.connect((err) =>{
            assert.equal(null,err);

            console.log("Connected successfully to server");
            const db = client.db(dbName);

            let cursor = db.collection('restaurants').findOne({_id:restaurantid}).then((data)=>{
                console.log("user: "+req.session.user._id);
                console.log("mimetype: "+data.mimetype);
                console.log("image: "+data.photo);
                if(data.mimetype){
                    photo=data.photo;
                    mimetype=data.mimetype;
                }
                console.log("mimetype: "+mimetype);
                res.status(200).render('upload',{message:"",isOwner:isOwner,photo:Buffer.from(photo,'base64'),mimetype:mimetype,restaurantid:req.query.restaurant});
            })
        });
        client.close();
    }catch(e){
        console.log(e);
    }
}

const showImg=(req,res)=>{
    var restaurantid=new mongo.ObjectID(req.params.restaurantid);
    const client=new MongoClient(mongourl);
    var mimetype=null,photo=null;
    try{
        client.connect((err) =>{
            assert.equal(null,err);

            console.log("Connected successfully to server");
            const db = client.db(dbName);

            let cursor = db.collection('restaurants').findOne({_id:restaurantid}).then((data)=>{
                console.log("user: "+req.session.user._id);
                console.log("mimetype: "+data.mimetype);
                console.log("image: "+data.photo);
                if(data.mimetype){
                    photo=data.photo;
                    mimetype=data.mimetype;
                }
                console.log("mimetype: "+mimetype);
                res.contentType(mimetype);
                res.send(photo);
            })
        });
        client.close();
    }catch(e){
        console.log(e);
    }
}

const uploadHandler=(req,res)=>{
    console.log(req.files.foo);
    var restaurantid=req.session.restaurant;
    var doc=req.files.foo;
    req.session.restaurant=null;
    
    const client=new MongoClient(mongourl);
    try{
        client.connect((err) =>{
            assert.equal(null,err);

            console.log("Connected successfully to server");
            const db = client.db(dbName);

            let cursor = db.collection('restaurants').updateOne(
                {_id:new mongo.ObjectID(restaurantid)},
                {$set:
                    {
                    mimetype:doc.mimetype,
                    photo:doc.data
                    }
                },
                (err,result)=>{
                    if(err){
                        console.log("err when uploading: "+err);
                        res.status(200).render('client', {message: 'Error when uploading file. Please try again.'});
                    }else{
                        res.status(200).render('client', {message: 'File Uploaded.'});
                    }
            });
        });
        client.close();
    }catch(e){
        console.log(e);
    }finally{

    }
}

app.get('/', (req, res) =>{
   console.log("session: "+req.session);
   searchHandler(req,res,req.query);
   if(!req.session.user)
       res.status(200).render('login',{message: ""});
       else
       res.status(200).render('client', {message:"Welcome, "+ "User : " +req.session.user.name});
});

app.get('/uploadDoc', (req, res) =>{
    console.log("entered upload doc");
    if(!req.session.user)
       res.status(200).render('login',{message: ""});
    else{
        getUpload(req,res);
    }
});

app.get('/loginac', (req, res) =>{
    res.status(200).render('login',{message: ""});
});

app.post('/loginac', (req, res) =>{
    loginHandler(req, res, req.body);
});
    
app.get('/register', (req, res) =>{
    res.status(200).render('register', {message: ""});
});

app.get('/registerac', (req, res) => {
    registerHandler(req, res, req.query);
});

app.get('/create', (req, res) =>{
    if(!req.session.user)
       res.status(200).render('login',{message: ""});
    else
        res.status(200).render('create', {message: ""});
});

app.get('/createRest', (req, res) =>{
    if(!req.session.user)
       res.status(200).render('login',{message: ""});
    else
        createHandler(req, res, req.query);
});

app.get('/display', (req, res) =>{
    if(!req.session.user)
       res.status(200).render('login',{message: ""});
    else
        res.status(200).render('display', {message: ""});
});

app.get('/search', (req, res) =>{
    if(!req.session.user)
       res.status(200).render('login',{message: ""});
    else
        res.status(200).render('search',{message:"",results:[]})
});

app.get('/searchR', (req, res) =>{
    if(!req.session.user)
       res.status(200).render('login',{message: ""});
    else
        searchHandler(req,res,req.query);
});

app.get('/logout', (req, res)=>{
    req.session.user = null;
    res.status(200).render('login', {message:"Logout success."});
});

app.get('/img/:restaurantid',(req,res)=>{
    showImg(req,res);
});

app.get('/showDoc', (req, res) =>{
    if(!req.session.user)
       res.status(200).render('login',{message: ""});
    else
        showDocHandler(req, res, req.query);
});

app.get('/showRate', (req, res) =>{
    if(!req.session.user)
       res.status(200).render('login',{message: ""});
    else
        rateHandler(req, res, req.query);
});

app.post('/rate', (req, res) =>{
    RateButtonHandler(req, res, req.body);
});

app.post('/upload', (req, res) =>{
    uploadHandler(req, res);
});

app.get('/*', (req,res) => {
    res.status(404).render('client', {message: `${req.path} - Unknown request!` });
});

app.listen(process.env.PORT || 8099);
