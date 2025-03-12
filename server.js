
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const app = express();

app.use(express.static("static"));

app
    .use(express.json())
    .use(express.urlencoded({ extended: true }))
    .use('/', express.static('static'))
    .set('view engine', 'ejs')
    .set('views', 'views')
    .get('/', home)
    .get('/login', login)
    .get('/createAccount', createAccount)
    .get('/mainscherm', mainscherm)
    .get('/koelkast', koelkast)
    .get('/pop-up', popup)
    .get('/apitest', apiTest)
    .get('/allergie', allergie)
    .get('/kookniveau', kookniveau)
    .get('/fetch-recipes', fetchRecipes) // Nieuwe route voor API-aanroepen
    .listen(2000, () => console.log("De server draait op host 2000"));

    // Use MongoDB
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
// Construct URL used to connect to database from info in the .env file
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}?retryWrites=true&w=majority`
// Create a MongoClient
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
})

function login(req, res) {
    res.render('login.ejs');
}

function createAccount(req, res) {
    res.render('createAccount.ejs');
}

function home(req, res) {
    res.render('recept-finder.ejs');
}

function mainscherm(req, res) {
    res.render('mainscherm.ejs');
}

function koelkast(req, res) {
    res.render('koelkast.ejs');
}

function popup(req, res) {
    res.render('pop-up.ejs');
}


function allergie(req, res) {
    res.render('allergie.ejs');
}

function kookniveau(req, res) {
    res.render('kookniveau.ejs');
}

async function apiTest(req, res) {

    const API_KEY = process.env.API_KEY;
const API_HOST = process.env.API_HOST;

    const url = 'https://tasty.p.rapidapi.com/recipes/list?from=0&size=1&tags=under_30_minutes';
const options = {
  method: 'GET',
  headers: {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': API_HOST
  }
};

try {
	const response = await fetch(url, options);
	const result = await response.json();
	console.log(result.results[0]['canonical_id']);
	console.log(result.results[0]['name']);
} catch (error) {
	console.error(error);
}
}

// API-aanroepen gedeelte

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

        // Controleer de status van de response
        if (!response.ok) {
            throw new Error(`API-fout: ${response.statusText}`);
        }

        // Probeer de JSON te parsen en log de response
        const data = await response.json();
        
        if (data && Object.keys(data).length === 0) {
            throw new Error('Lege response ontvangen');
        }

        return data;
    } catch (error) {
        console.error('Fout bij API-aanroep:', error);
        return null; // Geef null terug als er een fout optreedt
    }
}

// Nieuwe route voor het ophalen van recepten
async function fetchRecipes(req, res) {
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

    let allData = {}; // Object om alle verzamelde data op te slaan

    // Verwerk elke API-aanroep en verzamel de data
    for (const api of endpoints) {
        console.log(`Ophalen: ${api.name}`);
        const data = await fetchFromTasty(api.endpoint, api.params);
        
        if (data) {
            allData[api.name] = data;  // Bewaar de response per naam
        } else {
            allData[api.name] = 'Fout bij ophalen data';  // Als er een fout is
        }
    }

    // Toon de opgehaalde gegevens in de response
    res.json(allData.Receptenlijst); // Geef de verzamelde data als JSON terug
}


