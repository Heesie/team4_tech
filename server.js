const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const session = require('express-session')
const bcrypt = require('bcryptjs');
const xss = require('xss')
const validator = require('validator');
const app = express();
app.use(express.static('public'));

// BodyParser instellen om formuliergegevens te verwerken
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("static"));

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/', express.static('static'))
app.set('view engine', 'ejs')
app.set('views', 'views')
app.get('/', home)
app.get('/createAccount', createAccount)
app.get('/login', login)
app.get('/account', account)
app.get('/recept', receptScherm)
app.get('/koelkast', koelkast)
app.get('/pop-up', popup)
app.get('/allergie', allergie)
app.get('/kookniveau', kookniveau)
app.get('/fetch-recipes', fetchRecipes) 
app.get('/header', header) 
app.get('/footer', footer) 
app.get('/intro', tomaat) 
app.get('/fetchFromMongo', fetchFromMongo) // Nieuwe route voor API-aanroepen
    app .get('/mainscherm', async (req, res) => {
        try {
            const searchQuery = req.query.q;
            console.log (searchQuery)
            
    
            const db = client.db(process.env.DB_NAME);
            const collection = db.collection(process.env.DB_COLLECTION);
    
    const searchRegex = new RegExp(searchQuery, 'i');
    const recipes = await collection.find({
        $or: [
            { description: searchRegex }, 
            { keywords: searchRegex },
                ]
            }).toArray();
    
            res.render('mainscherm', { recipes, message: recipes.length ? "" : "Geen gerechten gevonden." });
            console.log("Recepten:", recipes)
    
        } catch (error) {
            console.error("Fout bij zoeken naar gerechten:", error);
            res.render('mainscherm', { recipes: [], message: "Er is een fout opgetreden." });
        }
    });
    app .listen(2000, () => console.log("De server draait op host 2000"));

app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET
}))

// Verbind met MongoDB database
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
// Maak de verbindingstring voor MongoDB met gegevens uit de .env file
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}?retryWrites=true&w=majority`
// Maak een nieuwe MongoClient aan om verbinding te maken met de MongoDB-database
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
})

////zoekfunctie////



async function fetchFromMongo(collectionRecepten, query = {}, options = {}) {
    try {
        const db = client.db(process.env.DB_NAME); // Verbind met de database
        const collection = db.collection(collectionRecepten); // Selecteer de collectie

        // Voer de query uit met eventuele opties (bijv. limiet, sortering)
        const results = await collection.find(query, options).toArray();
        return results;
    } catch (error) {
        console.error('Fout bij ophalen van gegevens uit MongoDB:', error);
        throw error; // Gooi de fout opnieuw om deze hogerop te behandelen
    }
}


// Probeer verbinding te maken met de database
client.connect()
  .then(() => {
    console.log('Verbinding met de database succesvol opgezet');
  })
  .catch((err) => {
    console.error(`Fout bij het verbinden met de database: ${err}`);
    console.error(`Gebruikte URI: ${uri}`);
  });

  function createAccount(req, res) {
    res.render('createAccount', { 
        errorMessage: '', 
        email: '', 
        username: '' 
    });
}

function login(req, res) {
    res.render('login', { errorMessage: '' });
}

function account(req, res) {
    res.render('account');
}

// Endpoint om (registratie)formuliergegevens te verwerken
app.post('/createAccount', async (req, res) => {
    let { email, username, password, passwordConfirm } = req.body;

    // Sanitizeer de invoer om XSS-aanvallen te voorkomen
    email = xss(email);
    username = xss(username);
    password = xss(password);
    passwordConfirm = xss(passwordConfirm);

    // Lege array om foutmeldingen op te slaan
    const errors = [];

    if (!validator.isEmail(email)) {
        errors.push('Ongeldig e-mailadres');
    }

    // Valideer wachtwoord
    if (!password || password.length === 0) {
        errors.push('Wachtwoord mag niet leeg zijn');
    } else if (password.length < 8) {
        errors.push('Wachtwoord moet minimaal 8 tekens lang zijn');
    } else if (!/[A-Z]/.test(password)) {
        errors.push('Wachtwoord moet minimaal één hoofdletter bevatten');
    } else if (!/[0-9]/.test(password)) {
        errors.push('Wachtwoord moet minimaal één cijfer bevatten');
    }

    if (password !== passwordConfirm) {
        errors.push('Wachtwoorden komen niet overeen');
    }

    // Als er fouten zijn, geef ze terug aan de gebruiker
    if (errors.length > 0) {
        return res.render('createAccount', { 
            errorMessage: errors.join(', '),
            email: email ,       // Zorg ervoor dat email wordt doorgegeven
            username: username   // Zorg ervoor dat username wordt doorgegeven
        });
    }

    try {
        // Verkrijg toegang tot de gebruikersverzameling in de database
        const database = client.db(process.env.DB_NAME);
        const usersCollection = database.collection('users');

        // Controleer of e-mail al bestaat
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) return res.render('createAccount', { errorMessage: 'E-mail is al geregistreerd' });

        // Wachtwoord hashen
        const hashedPassword = await bcrypt.hash(password, 10);

        // Voeg gebruiker toe aan database
        await usersCollection.insertOne({ username, email, password: hashedPassword });

        console.log("Gebruiker aangemaakt:", { username, email });
        res.redirect('/account');
    } catch (err) {
        console.error("Fout bij registreren:", err);
        res.status(500).send("Server error");
    }
});

// Endpoint om (inlog)formuliergegevens te verwerken
app.post('/login', async (req, res) => {
    let { email, password } = req.body;

    // Sanitizeer de invoer om XSS-aanvallen te voorkomen
    email = xss(email);  
    password = xss(password);

    const errors = [];

    if (!validator.isEmail(email)) {
        errors.push('Ongeldig e-mailadres');
    }

    if (!password || password.length === 0) {
        errors.push('Wachtwoord mag niet leeg zijn');
    }

    if (errors.length > 0) {
        return res.render('login', { errorMessage: errors.join(', ') });
    }

    try {
        // Verkrijg toegang tot de gebruikersverzameling in de database
        const database = client.db(process.env.DB_NAME);
        const usersCollection = database.collection('users');

        // Zoek de gebruiker op e-mail
        const user = await usersCollection.findOne({ email });
        if (!user) return res.render('login', { errorMessage: 'E-mail niet gevonden' });

        // Vergelijk het wachtwoord
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.render('login', { errorMessage: 'Ongeldig wachtwoord' });

        console.log('Inloggen succesvol:', { email });

        // Sla de gebruikers-ID op in de sessie
        req.session.userId = user._id;  // Dit is de gebruikers-ID die je in de sessie wilt bewaren
        req.session.username = user.username;  // Je kunt ook andere gegevens bewaren als je wilt

        // Redirect naar de gewenste pagina, bijvoorbeeld de homepage of dashboard
        res.redirect('/');
    } catch (err) {
        console.error("Fout bij inloggen:", err);
        res.status(500).send("Server error");
    }
});

function home(req, res) {
    res.render('recept-finder.ejs');
}



async function home (req, res) {
    try {
        // Haal recepten op
        const data = await fetchFromTasty('recipes/list', { from: 0, size: 20, tags: 'under_30_minutes' });

        // Controleer of er resultaten zijn
        const recipes = data?.results.map(recipe => ({
            id: recipe.id,
            name: recipe.name,
            description: recipe.description || 'Geen beschrijving beschikbaar',
            imageUrl: recipe.thumbnail_url || '/images/default-recipe.jpg' // Standaard afbeelding als geen beschikbaar is
        })) || [];

        res.render('recept-finder.ejs', { recipes });
    } catch (error) {
        console.error('Fout bij ophalen van recepten:', error);
        res.render('recept-finder.ejs', { recipes: [] });
    }
}



function koelkast(req, res) {
    res.render('koelkast.ejs');
}

function receptScherm(req, res) {
    res.render('recept.ejs');
}

function popup(req, res) {
    res.render('pop-up.ejs');
}

function header(req, res) {
    res.render('header.ejs');
}

function footer(req, res) {
    res.render('footer.ejs');
}
function allergie(req, res) {
    res.render('allergie.ejs');
}

function kookniveau(req, res) {
    res.render('kookniveau.ejs');
}

function tomaat(req, res) {
    res.render('intro.ejs');
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

// 404-foutafhandelingsmiddleware
app.use((req, res) => {
    res.status(404).send("Pagina niet gevonden");
});

// 500-foutafhandelingsmiddleware
app.use((err, req, res) => {
    console.error(err.stack);
    res.status(500).send("Er is een serverfout opgetreden!");
});




