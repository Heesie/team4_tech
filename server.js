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

app.use(session({
    resave: false, // De sessie wordt niet opnieuw opgeslagen op elke aanvraag
    saveUninitialized: true, // Nieuwe sessie wordt altijd opgeslagen
    secret: process.env.SESSION_SECRET, // De geheime sleutel om de sessie-id te ondertekenen en te versleutelen
    cookie: {
        httpOnly: true, // Beveiligt tegen XSS
        secure: process.env.NODE_ENV === 'production', // Alleen HTTPS in productie
        maxAge: 1000 * 60 * 60 * 24 // Sessieduur: 24 uur
    }
}))

app.use((req, res, next) => {
    // Gebruikersgegevens uit de sessie beschikbaar voor de views
    res.locals.username = req.session.username || null; // Gebruikersnaam
    res.locals.email = req.session.email || null;       // E-mailadres

    next(); // Ga verder naar de volgende route
});

app.use('/', express.static('static'))
app.set('view engine', 'ejs')
app.set('views', 'views')
app.get('/', home)
app.get('/createAccount', createAccount)

// Route om uit te loggen
app.get('/logout', (req, res) => {
    // Verwijder de sessie van de gebruiker
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Fout bij het uitloggen');
        }
        // Sessie is succesvol verwijderd, stuur door naar de loginpagina
        res.redirect('/login');
        console.log("Uitgelogd!")
    });
});

app.get('/login', login)
app.get('/account', authMiddleware, account);
app.get('/favorites', favorites)
app.get('/favorieten', favorieten) 
app.get('/header', header) 
app.get('/fetchFromMongo', fetchFromMongo) // Nieuwe route voor API-aanroepen
app.get('/mainscherm', async (req, res) => {
    try {
        // Haal alle filters op uit de query, maar negeer de 'removeFilter' parameter
        const filters = { ...req.query };
        delete filters.removeFilter; // Verwijder 'removeFilter' als het in de query zit

        const searchQuery = filters.q || ""; // Zoekterm (optioneel)
        const ingredientFilter = filters.mainingredient; // Hoofdingrediënt filter
        const servingsFilter = filters.servings; // Aantal porties filter
        const preptimeFilter = filters.preptime; // Bereidingstijd filter

        console.log("Zoekopdracht en filters:", filters);

        const db = client.db(process.env.DB_NAME);
        const collection = db.collection(process.env.DB_COLLECTION);
        const usersCollection = db.collection('users');

        // Bouw de zoekopdracht
        let query = {};

        if (searchQuery) {
            const searchRegex = new RegExp(searchQuery, 'i');
            query.$or = [
                { description: searchRegex },
                { keywords: searchRegex }
            ];
        }

        if (ingredientFilter) {
            query["ingredients.name"] = { $regex: new RegExp(ingredientFilter, "i") };
        }

        if (servingsFilter) {
            const servings = parseInt(servingsFilter, 10);
            if (!isNaN(servings)) {
                query["num_servings"] = servings;
            }
        }

        if (preptimeFilter) {
            const time = parseInt(preptimeFilter, 10);
            if (!isNaN(time)) {
                query["total_time_minutes"] = { $lte: time };
            }
        }

        // Haal resultaten op
        const results = await collection.find(query).toArray();

        // Haal de gebruiker op (als ingelogd)
        let likedRecipes = [];
        if (req.session.userId) {
            try {
                const user = await usersCollection.findOne({ _id: new ObjectId(req.session.userId) });
                if (user && user.likes) {
                    likedRecipes = user.likes;
                }
            } catch (userError) {
                console.error("Fout bij ophalen van gebruiker:", userError);
            }
        }

        // Render de pagina met recepten
        res.render('mainscherm', {
            recipes: results.map(recipe => ({
                ...recipe,
                isLiked: likedRecipes.includes(recipe._id.toString()) // Controleer of recept is geliked
            })),
            message: results.length ? "" : "Geen gerechten gevonden.",
            selectedFilters: filters // Voeg geselecteerde filters door aan de view
        });

    } catch (error) {
        console.error("Fout bij ophalen van recepten:", error);
        
        // Render fallback pagina met foutmelding
        res.render('mainscherm', { 
            recipes: [], 
            message: "Er is een fout opgetreden bij het ophalen van de recepten.", 
            selectedFilters: req.query 
        });
    }
});




app.get('/recipe/:id', async (req, res) => {
    try {
        const recipeId = req.params.id;
        const db = client.db(process.env.DB_NAME);
        const collection = db.collection(process.env.DB_COLLECTION);

        // Zoek het recept op basis van het ID
        const recipe = await collection.findOne({ _id: new ObjectId(recipeId) });

        if (!recipe) {
            return res.status(404).send("Recept niet gevonden");
        }

        res.render('recept', { recipe });
    } catch (error) {
        console.error("Fout bij ophalen van recept:", error);
        res.status(500).send("Er is een fout opgetreden bij het ophalen van het recept.");
    }
});

// Like een recept
app.post('/like/:recipeId', authMiddleware, async (req, res) => {
    const recipeId = req.params.recipeId; // Haal het recept-ID uit de URL
    const userId = req.session.userId; // Haal de gebruikers-ID uit de sessie

    try {
        const db = client.db(process.env.DB_NAME);
        const usersCollection = db.collection('users');

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) }, // Vind de gebruiker op basis van hun userID
            { $addToSet: { likes: recipeId } } // Voeg het recept toe aan de lijst van 'likes'
        );

        if (result.modifiedCount === 1) {
            return res.json({ success: true, message: 'Recept toegevoegd aan favorieten!' });
        } else {
            res.status(400).send({ message: 'Recept al in je favorieten of iets ging mis' });
        }
    } catch (error) {
        console.error('Fout bij het liken van recept:', error);
        res.status(500).send("Server error");
    }
});

// Unlike een recept
app.post('/unlike/:recipeId', authMiddleware, async (req, res) => {
    const recipeId = req.params.recipeId;
    const userId = req.session.userId;

    try {
        const db = client.db(process.env.DB_NAME);
        const usersCollection = db.collection('users');

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $pull: { likes: recipeId } } // Verwijder het recept uit de lijst van favorieten
        );

        if (result.modifiedCount === 1) {
            return res.json({ success: true, message: 'Recept verwijderd uit favorieten!' });
        } else {
            res.status(400).send({ message: 'Recept is al niet in je favorieten of iets ging mis' });
        }
    } catch (error) {
        console.error('Fout bij het unliken van recept:', error);
        res.status(500).send("Server error");
    }
});

    app .listen(2000, () => console.log("De server draait op host 2000"));

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

function authMiddleware(req, res, next) {
    if (!req.session || !req.session.userId) {
        console.log("Geen actieve sessie of niet ingelogd, doorsturen naar login");
        return res.redirect('/login');
    }
    next(); // Gebruiker is ingelogd, ga door naar de volgende functie
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
            email: email ,       // E-mail wordt doorgegeven
            username: username   // Username wordt doorgegeven
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
        if (!user) {
            return res.render('login', { errorMessage: 'E-mail niet gevonden' });
        }
    
        // Vergelijk het wachtwoord
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.render('login', { errorMessage: 'Ongeldig wachtwoord' });
        }
        
        // Sla de gebruikersgegevens op in de sessie
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.email = user.email;
    
        console.log("Sessie na login:", req.session);
    
        req.session.save(err => {
            if (err) {
                console.error("Fout bij opslaan sessie:", err);
                return res.status(500).send("Sessie kon niet worden opgeslagen.");
            }
            res.redirect('/');
        });
    
    } catch (err) {
        console.error("Fout bij inloggen:", err);
        res.status(500).send("Server error");
    }
});

function favorites(req, res) {
    res.render('favorites.ejs');
}


async function home(req, res) {
    try {
        // Maak verbinding met de MongoDB database
        const db = client.db(process.env.DB_NAME);
        const collection = db.collection(process.env.DB_COLLECTION);

        // Haal alle recepten op uit de database (limiet op 20 voor prestaties)
        const recipes = await collection.find().limit(20).toArray();

        // Zorg ervoor dat de recepten correct worden geformatteerd voor de EJS-weergave
        const formattedRecipes = recipes.map(recipe => ({
            _id: recipe._id.toString(), // ObjectId naar string converteren
            name: recipe.name,
            description: recipe.description || 'Geen beschrijving beschikbaar',
            thumbnail_url: recipe.thumbnail_url || '/images/default-recipe.jpg' // Standaardafbeelding als er geen beschikbaar is
        }));

        // Render de beginscherm.ejs met de recepten
        res.render('beginscherm.ejs', { recipes: formattedRecipes });
    } catch (error) {
        console.error('Fout bij ophalen van recepten uit MongoDB:', error);
        res.render('beginscherm.ejs', { recipes: [] }); // Render een lege lijst bij een fout
    }
}

function favorieten (req, res) {
    res.render('favorieten.ejs');
}

function header(req, res) {
    res.render('header.ejs');
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



app.get('/favorieten', async (req, res) => {
    try {
        // Haal favorieten op uit de database (tijdelijk een lege array als de backend er nog niet is)
        const favoriteRecipes = []; // Simuleer dat er nog geen recepten zijn

        res.render('favorieten', { recipes: favoriteRecipes }); // Zorg dat 'recipes' bestaat
    } catch (error) {
        console.error(error);
        res.status(500).send("Er is een fout opgetreden.");
    }
});




// search function 

app.get('/beginscherm', async (req, res) => {
    try {
        const searchQuery = req.query.q || ""; // Zoekterm (optioneel)
        const ingredientFilter = req.query.mainingredient; // Hoofdingrediënt filter
        const servingsFilter = req.query.porties; // Aantal porties filter
        const bereidingstijdFilter = req.query.bereidingstijd; // Bereidingstijd filter
     
        console.log("Zoekopdracht en filters:", req.query);
     
        const db = client.db(process.env.DB_NAME);
        const collection = db.collection(process.env.DB_COLLECTION);
     
        // Bouw de zoekopdracht
        let query = {};
     
        if (searchQuery) {
            const searchRegex = new RegExp(searchQuery, 'i');
            query.$or = [
                { description: searchRegex },
                { keywords: searchRegex }
            ];
        }
     
        if (ingredientFilter) {
            query["ingredients.name"] = { $regex: new RegExp(ingredientFilter, "i") };
        }
     
        if (servingsFilter) {
            const porties = parseInt(servingsFilter, 10);
            if (!isNaN(porties)) {
                query["num_servings"] = porties;
            }
        }
     
        if (bereidingstijdFilter) {
            const tijd = parseInt(bereidingstijdFilter, 10);
            if (!isNaN(tijd)) {
                query["total_time_minutes"] = { $lte: tijd };
            }
        }
     
        // Verifieer de opgestelde query
        console.log("Opgebouwde MongoDB query:", JSON.stringify(query, null, 2));
     
        // Haal de recepten op uit de database op basis van de opgestelde query
        const recipes = await collection.find(query).toArray();
     
        // Render de pagina met de recepten (of een bericht als er geen recepten zijn)
        res.render('mainscherm', {
            recipes,
            message: recipes.length ? "" : "Geen gerechten gevonden.",
            selectedFilters: req.query // Voeg geselecteerde filters door aan de view
        });
     
    } catch (error) {
        console.error("Fout bij ophalen van gerechten:", error);
        res.render('mainscherm', { recipes: [], message: "Er is een fout opgetreden." });
    }
    });