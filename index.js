const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require(`${__dirname}/models/user`);
const Post = require(`${__dirname}/models/post`);
const bcrypt = require('bcryptjs');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer  = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs');


const salt = bcrypt.genSaltSync(10); /* It's use for encrypt our password in server */
const secret = 'cndjlzskzdx';


// app.use(cors({ credentials: true, origin: '*' }));
// app.use(cors({ origin: '*' }));
var whitelist = ['http://localhost:4000','http://localhost:3000', /** other domains if any */ ]
var corsOptions = {
  credentials: true,
  origin: function(origin, callback) {

    if (origin === undefined || whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));


mongoose.connect('mongodb://root:dNzqnw0gFBCiO8HCGdKoJ1GC@kamet.liara.cloud:30277/my-app?authSource=admin&replicaSet=rs0&directConnection=true')

    .then(() => {
        console.log('Mongo is connected !')
    });

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userDoc = await User.create({
            username,
            password: bcrypt.hashSync(password, salt),
        });
        res.json(userDoc);
    } catch (e) {
        console.log(e);
        res.status(400).json(e);
    }

});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    User.findOne({ username })
        .then(userDoc => {
            if (!userDoc) {
                return res.status(400).json('Wrong credentials!');
            }
            const passOk = bcrypt.compareSync(password, userDoc.password);
            if (passOk) {
                jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
                    if (err) {
                        return res.status(500).json('Internal server error');
                    }
                    res.cookie('token', token).json({
                        id: userDoc._id,
                        username,
                    });
                });
            } else {
                res.status(400).json('Wrong credentials!');
            }
        })
        .catch(error => {
            console.log(error);
            res.status(500).json('Internal server error');
        });
});

app.get('/profile', (req, res) => {
    const { token } = req.cookies;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Token not provided' });
    }
    // res.json(req.cookies);
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) {
            console.error('Error verifying token:', err);
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        res.json(info);
    });
});


app.post('/logout', (req , res) => {
    res.cookie('token' , '',  { maxAge: 0, httpOnly: true }).json('ok');
});


app.post('/post', uploadMiddleware.single('file') , async (req , res) => {
    const {originalname ,  path} = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length-1]; 
    const newPath = path+'.'+ext ;
    fs.renameSync(path, newPath); 

    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err,info) => {
     if (err) throw err;
        const {id,title,summary,content} = req.body;
        const postDoc = await Post.create({
                title,
                summary,
                content,
                cover:newPath,
                author:info.id 
            });

             res.json(postDoc); 
            // console.log (res.json('ok')); 


         });

});

app.put('/post',uploadMiddleware.single('file'), async (req,res) => {
    let newPath = null;
    if (req.file) {
      const {originalname,path} = req.file;
      const parts = originalname.split('.');
      const ext = parts[parts.length - 1];
      newPath = path+'.'+ext;
      fs.renameSync(path, newPath);
    }
    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err,info) => {
      if (err) throw err;
      const {id,title,summary,content} = req.body;
      const postDoc = await Post.findById(id);
      const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
      if (!isAuthor) {
        return res.status(400).json('you are not the author');
      }
    //   await postDoc.update
    //   ({
    //     title,
    //     summary,
    //     content,
    //     cover: newPath ? newPath : postDoc.cover,
    //   });
    const updatedPostDoc = await Post.findOneAndUpdate(
        { _id: id },
        {
            $set: {
                title,
                summary,
                content,
                cover: newPath ? newPath : postDoc.cover,
            }
        },
        { new: true } // Return the updated document
    );
  
      res.json(updatedPostDoc);
    });
});

app.get('/post' , async (req , res) => {
    res.json(
        await Post.find()
        .populate('author', ['username'])
        .sort({createdAt: -1})
        .limit(20)

        );
});


app.get('/post/:id', async (req, res) => {
    const {id} = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
  })
  

app.listen(4000, () => {
    console.log('Server is running on port 4000 !')
});
