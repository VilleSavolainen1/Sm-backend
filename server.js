require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors')
const bcrypt = require('bcrypt');
const app = express();
const knex = require('knex');
const multer = require('multer');
const fs = require('fs');



const db = knex({
    client: 'pg',
    connection: {
        host: process.env.PG_HOST,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE
    }
});

app.use(cors());
app.use(express.static('images'));
app.use('/images', express.static('images'));
app.use(bodyParser.json());

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'images')
    },
    filename: (req, file, cb) => {
        const date = new Date();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const fileName = hours + minutes + file.originalname.toLowerCase();
        cb(null, fileName)
    }
})

const upload = multer({ storage: storage });

//Getting all image names
app.post('/imagenames', async (req, res) => {
    let { username } = req.body;
    try {
        await db.select('image').from('images').where('username', '=', username)
            .then(name => {
                res.json(name.map(n => n.image))
            }).catch(e => console.log(e))
    } catch (e) {
        console.log(e)
    }
})

//Profile
app.get('/profile', async (req, res) => {
    let { username } = req.body;
    try {
        await db.select('image').from('images').where('username', '=', username)
            .then(image => {
                res.json(image.map(i => i.image));
            })
    } catch (e) {
        console.log(e)
    }
})

//All users
app.get('/users', async (req, res) => {
    try {
        await db.select('username').from('users')
            .then(user => {
                res.json(user.map(u => u.username))
            })
    } catch (e) {
        res.json(e)
    }
})

//All images
app.get('/images', (req, res) => {
    let { imagename } = req.body;
    res.sendFile(__dirname + '/images/' + imagename)
})

//Uploading image...
app.post('/save-image', upload.single('file'), (req, res) => {
    res.send("saved")
})


//..and saving name
app.post('/save-imagename', upload.single('file'), (req, res) => {
    const date = new Date();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    let { username, image } = req.body;
    try {
        db.insert({ username: username, image: hours + minutes + image })
            .into('images')
            .then(res => {
                console.log("added")
            })
    } catch (e) {
        console.log(e)
    }
    return res.json({ status: 'ok' })
})

//Delete image
app.post('/delete', (req, res) => {
    let { imagename, username } = req.body;
    try {
        fs.unlink(__dirname + '/images/' + imagename, (err) => {
            console.log('deleted ' + imagename)
        });
        db.delete().from('images').where('image', '=', imagename).andWhere('username', '=', username)
            .then(msg => {
                res.json("deleted")
            }).catch(e => {
                res.json(e)
            })
    } catch (e) {
        res.json(e)
    }
})

//Get messages via images name
app.post('/messages', (req, res) => {
    let { image } = req.body;
    db.select('*').from('messages').where('image', '=', image.split("/")[4]).then(messages => {
        res.json(messages)
    })
        .catch(err => res.status(400).json('Not found'))
})

//Signin
app.post('/signin', (req, res) => {
    db.select('username', 'password').from('users')
        .where('username', '=', req.body.username)
        .then(data => {
            const isValid = bcrypt.compareSync(req.body.password, data[0].password);
            if (isValid) {
                return db.select('*').from('login')
                    .where('name', '=', req.body.username)
                    .then(user => {
                        res.json(user[0])
                    })
                    .catch(err => res.status(400).send(err))
            } else {
                res.status(500).json("väärin")
            }
        })
        .catch(err => res.status(400).json(err))
})


//Send message
app.post('/sendmessages', async (req, res) => {
    try {
        let { image, sender, receiver, message, date } = req.body;
        let seen = false;
        await db.insert({ image, sender, receiver, message, date, seen })
            .into('messages')
            .then(status => {
                res.json(status);
            })
    } catch (e) {
        console.log(e)
        res.status(500).send(e)
    }
})

//Get unseen messages
app.post('/unseen', async(req, res) => {
 let {receiver} = req.body;
 await db.select('*').from('messages').where('receiver', '=', receiver)
 .then(r => {
     res.json(r)
 })
 .catch((err => {console.log(err)}))
})

//Delete message
app.post('/deletemessage', async (req, res) => {
    try {
        let { image } = req.body;
        await db.delete().from('messages').where('image', '=', image)
            .then(status => {
                res.json("deleted")
            })
    } catch (e) {
        res.status(500).send(e)
    }
})


//Register
app.post('/register', async (req, res) => {
    let { username, password, email } = req.body;
    try {
        await db.select().from('users').where('email', '=', email)
            .then(async data => {
                if (data.length > 0) {
                    res.status(400).send('Käyttäjä löytyy jo!');
                } else {
                    const hash = await bcrypt.hash(password, 10);
                    await db.transaction(trx => {
                        trx.insert({ username: username, password: hash, email: email })
                            .into('users')
                            .returning('username')
                            .then(loginName => {
                                return trx('login').insert({
                                    name: username,
                                    joined: new Date()
                                })
                                    .then(user => {
                                        res.json(user[0])
                                    })
                            })
                            .then(trx.commit)
                            .catch(trx.rollback)
                    })
                };
            })
    } catch (e) {
        console.log(e)
        res.status(500).send(e)
    }
})


app.listen(process.env.port, () => console.log("server started"))
