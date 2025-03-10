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


    .get ('/mainscherm', mainscherm)
    .get ('/koelkast', koelkast)
    .get ('/pop-up', popup )

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




/* gedeelte API */

const API_KEY = process.env.API_KEY;
const API_HOST = process.env.API_HOST;

async function fetchFromTasty(endpoint, params = {}) {
    const url = new URL(`https://${API_HOST}/${endpoint}`);

    // Voeg queryparameters toe aan de URL
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': API_KEY,
                'X-RapidAPI-Host': API_HOST
            }
        });

        if (!response.ok) {
            throw new Error(`API-fout: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Fout bij API-aanroep:', error);
    }
}

// API-aanroepen met specifieke parameters
const endpoints = [
    { name: 'Auto-complete', endpoint: 'recipes/auto-complete', params: { prefix: 'chicken soup' } },
    { name: 'Receptenlijst', endpoint: 'recipes/list', params: { from: 0, size: 20, tags: 'under_30_minutes' } },
    { name: 'Vergelijkbare recepten', endpoint: 'recipes/list-similarities', params: { recipe_id: 8138 } },
    { name: 'Meer info over recept', endpoint: 'recipes/get-more-info', params: { id: 8138 } },
    { name: 'Tips lijst', endpoint: 'tips/list', params: { from: 0, size: 30, id: 3562 } },
    { name: 'Tags lijst', endpoint: 'tags/list', params: {} },
    { name: 'Feeds lijst', endpoint: 'feeds/list', params: { size: 5, timezone: '+0700', vegetarian: false, from: 0 } },
    { name: 'Receptdetails', endpoint: 'recipes/detail', params: { id: 5586 } }
];

// Voer alle API-aanroepen uit
async function fetchAllEndpoints() {
    for (const api of endpoints) {
        console.log(`Ophalen: ${api.name}`);
        const data = await fetchFromTasty(api.endpoint, api.params);
        console.log(`${api.name} data:`, data);
    }
}

fetchAllEndpoints();


    
