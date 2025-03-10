const dotenv = require('dotenv')
dotenv.config();

const express = require('express');
const app = express()


const apiKey = process.env.API_KEY;



app
    .use (express.json())
    .use (express.urlencoded({extended: true}))
    .use ('/', express.static('static'))

    .set ('view engine', 'ejs')
    .set ('views', 'views')

    .get ('/', home)
    .get ('/login', login)
    .get ('/createAccount', createAccount)


    .get ('/mainscherm', mainscherm)
    .get ('/koelkast', koelkast)
    .get ('/pop-up', popup )
    .get ('/uploading', uploading )

    .listen(2000)

console.log("de server draait op host 2000")
    function login (req, res) {
        res.render('login.ejs');
    }

    function createAccount (req, res) {
        res.render('createAccount.ejs');
    }

    function home (req, res) {
        res.render('recept-finder.ejs');
    }


    function mainscherm (req, res) {
        res.render('mainscherm.ejs');
    }

    function koelkast (req, res) {
        res.render('koelkast.ejs');
    }

    function popup (req, res) {
        res.render('pop-up.ejs');
    }
    
    function uploading (req, res) {
        res.render('uploading.ejs');
    }




/* gedeelte hier beneden de uploading */

const multer  = require('multer')
const upload = multer({ dest: './public/data/uploads/' })
app.post('/stats', upload.single('uploaded_file'), function (req, res) {
   console.log(req.file, req.body)
});



    
