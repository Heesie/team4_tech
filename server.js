const dotenv = require('dotenv')
dotenv.config();

const express = require('express');
const app = express()


app
    .use (express.json())
    .use (express.urlencoded({extended: true}))
    .use ('/', express.static('static'))

    .set ('view engine', 'ejs')
    .set ('views', 'views')

    .get ('/', home)
    .get ('/login', login)
    .get ('/createAccount', createAccount)

    .listen(2000)

    function home (req, res) {
        res.render('index.ejs');
    }

    function login (req, res) {
        res.render('login.ejs');
    }

    function createAccount (req, res) {
        res.render('createAccount.ejs');
    }




