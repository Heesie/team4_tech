// Laad omgevingsvariabelen
const dotenv = require('dotenv');
dotenv.config();
 
// Externe libraries
const express = require('express');
const session = require('express-session');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const xss = require('xss');
const validator = require('validator');

// Express applicatie
const app = express();

// Configureer sessie-instellingen
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

const http = require('http');
const socketIo = require('socket.io');
const server = http.createServer(app);
const io = socketIo(server);

// Statische bestanden
app.use(express.static('public'));
app.use(express.static("static"));

// Maak de verbindingstring voor MongoDB met gegevens uit de .env file
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
});

async function connectDB() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
    }
}

connectDB();
 
// Verbind met de MongoDB-database
const db = client.db(process.env.DB_NAME);
const recipesCollection = db.collection('recipes');
const usersCollection = db.collection('users');
const chatCollection = db.collection('chats');  // MongoDB collecties

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use((req, res, next) => {
    // Gebruikersgegevens uit de sessie beschikbaar voor de views
    res.locals.username = req.session.username || '';
    res.locals.email = req.session.email || '';
 
    next(); // Ga verder naar de volgende route
});
app.use('/', express.static('static'))

app.set('view engine', 'ejs')
app.set('views', 'views')
app.get('/', home)
app.get('/createAccount', createAccount)
app.get('/favorites', favorites)
app.get('/recipes', allrecipes);
app.get('/header', header)
app.get('/fetchFromMongo', fetchFromMongo) // Nieuwe route voor API-aanroepen
app.get('/login', login)
app.get('/logout', logout)
app.get('/account', authMiddleware, account);
app.get('/recipe/:id', getRecipe);

app.post('/toggle-like/:recipeId', authMiddleware, async (req, res) => {
    await toggleLikeStatus(req, res);  // Roep de toggleLikeStatus functie aan
});
app.post('/createAccount', processRegistration);
app.post('/login', processLogin);
  
app.get('/chat/:userId', authMiddleware, async (req, res) => {
    try {
        const userId = req.params.userId;
        const currentUserId = req.session.userId;
 
        if (!currentUserId) {
            return res.redirect('/login');
        }
 
        const messages = await chatCollection.find({
            $or: [
                { senderId: currentUserId, receiverId: userId },
                { senderId: userId, receiverId: currentUserId }
            ]
        }).sort({ timestamp: 1 }).toArray();
 
        res.render('recipe.ejs', { messages });
    } catch (error) {
        console.error("Fout bij ophalen van chatberichten:", error);
        res.status(500).send("Er is een fout opgetreden bij het ophalen van de chat.");
    }
});
 
server.listen(2000, () => console.log("Server running on port 2000"));
 
 
io.on("connection", (socket) => {
    console.log("A user connected");
 
 
    socket.on("joinRoom", async (recipeId) => {
        socket.join(recipeId);
 
        try {
        
            const messages = await chatCollection.find({ recipeId }).toArray();
            socket.emit("previousMessages", messages);  
        } catch (error) {
            console.error("Fout bij ophalen berichten:", error);
        }
    });
 
 
    socket.on("sendMessage", async ({ recipeId, username, message }) => {
        const timestamp = new Date().toISOString();
        const chatMessage = { recipeId, username, message, timestamp };
 
        try {
    
            await chatCollection.insertOne(chatMessage);
           
            io.to(recipeId).emit("newMessage", chatMessage);
        } catch (error) {
            console.error("Fout bij opslaan bericht:", error);
        }
    });
 
    socket.on("disconnect", () => {
        console.log("A user disconnected");
    });
});

async function home(req, res) {
    try {
    
        const recipes = await fetchFromMongo('recipes', {}, { limit: 20 });
 
   
        let likedRecipes = [];
        if (req.session.userId) {
            try {
                const user = await usersCollection.findOne({ _id: new ObjectId(req.session.userId) });
                if (user && user.likes) {
                    likedRecipes = user.likes;
                }
            } catch (userError) {
                console.error("Error fetching user:", userError);
            }
        }
 
    
        const formattedRecipes = recipes.map(recipe => ({
            _id: recipe._id.toString(),
            name: recipe.name,
            description: recipe.description || 'No description available',
            thumbnail_url: recipe.thumbnail_url || '/images/default-recipe.jpg',
            isLiked: likedRecipes.includes(recipe._id.toString())
        }));
 
 
        res.render('home.ejs', { recipes: formattedRecipes });
    } catch (error) {
        console.error('Error fetching recipes from MongoDB:', error);
        res.render('home.ejs', { recipes: [] });
    }
}

async function allrecipes(req, res) {
    try {
        // Haal alle filters op uit de query, maar negeer de 'removeFilter' parameter
        const filters = { ...req.query };
        delete filters.removeFilter; // Verwijder 'removeFilter' als het in de query zit
 
        const searchQuery = filters.q || ""; // Zoekterm (optioneel)
        const ingredientFilter = filters.mainingredient; // Hoofdingrediënt filter
        const servingsFilter = filters.servings; // Aantal porties filter
        const preptimeFilter = filters.preptime; // Bereidingstijd filter
 
        console.log("search and filters:", filters);

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
        const results = await recipesCollection.find(query).toArray();

        // Haal de gebruiker op (als ingelogd)
        let likedRecipes = [];
        if (req.session.userId) {
            try {
                const user = await usersCollection.findOne({ _id: new ObjectId(req.session.userId) });
                if (user && user.likes) {
                    likedRecipes = user.likes;
                }
            } catch (userError) {
                console.error("Error fetching user:", userError);
            }
        }
 
        // Render de pagina met recepten
        res.render('recipes', {
            recipes: results.map(recipe => ({
                ...recipe,
                isLiked: likedRecipes.includes(recipe._id.toString()) // Controleer of recept is geliked
            })),
            message: results.length ? "" : "No recipes found",
            selectedFilters: filters // Voeg geselecteerde filters door aan de view
        });
 
    } catch (error) {
        console.error("Error fetching recipes:", error);
        
        // Render fallback pagina met foutmelding
        res.render('recipes', {
            recipes: [],
            message: "An error occurred while fetching the recipes.",
            selectedFilters: req.query
        });
    }
}
 
async function getRecipe(req, res) {
    try {
        const recipeId = req.params.id;
 
        // Gebruik fetchFromMongo om het recept op te halen
        const recipes = await fetchFromMongo('recepten', { _id: new ObjectId(recipeId) });
 
        if (recipes.length === 0) {
            return res.status(404).send("Recipe not found");
        }
 
        const recipe = recipes[0]; // Aangezien we maar één recept ophalen, pakken we het eerste element uit de array
        console.log("LIKES", recipe)
        let userlogged = req.session.userId;
        res.render('recipe', { recipe, userlogged });
    } catch (error) {
        console.error("Error fetching recipes:", error);
        res.status(500).send("An error occurred while fetching the recipe");
    }
}
 
async function favorites(req, res) {
    try {
        if (!req.session.userId) {
            return res.redirect('/login'); // Redirect als gebruiker niet is ingelogd
        }
 
        const user = await usersCollection.findOne({ _id: new ObjectId(req.session.userId) });
 
        if (!user || !user.likes || user.likes.length === 0) {
            return res.render('favorites', { recipes: [], message: "You have no favorites yet." });
        }
 
        // Haal de recepten op die geliket zijn
        const favoriteRecipes = await recipesCollection.find({
            _id: { $in: user.likes.map(id => new ObjectId(id)) }
        }).toArray();
 
        res.render('favorites', { recipes: favoriteRecipes, message: "" });
    } catch (error) {
        console.error("Error fetching favorites:", error);
        res.status(500).send("An error occurred.");
    }
}
 
// Functie voor het toggelen van de like-status van een recept
async function toggleLikeStatus(req, res) {
    const recipeId = req.params.recipeId;
    const userId = req.session.userId;  // Haal de ingelogde gebruiker uit de sessie

    try {
        // Zoek het recept op basis van het recipeId
        const recipe = await recipesCollection.findOne({ _id: new ObjectId(recipeId) });
        if (!recipe) return res.status(404).send("Recipe not found");

        // Zoek de gebruiker in de gebruikerscollectie
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (!user) return res.status(404).send("User not found");

        // Controleer of het recept al geliked is
        const isLiked = user.likes.includes(recipeId);

        // Toggle de like status in de gebruikerslijst
        if (isLiked) {
            // Verwijder het recept uit de favorieten
            await usersCollection.updateOne(
                { _id: new ObjectId(userId) },
                { $pull: { likes: recipeId } }  // Verwijder het recept uit de lijst van likes
            );
        } else {
            // Voeg het recept toe aan de favorieten
            await usersCollection.updateOne(
                { _id: new ObjectId(userId) },
                { $addToSet: { likes: recipeId } }  // Voeg het recept toe aan de lijst van likes
            );
        }

        // Update de 'isLiked' status van het recept voor pagina van het recept
        await recipesCollection.updateOne(
            { _id: new ObjectId(recipeId) },
            { $set: { isLiked: !isLiked } }
        );

        // Redirect terug naar de vorige pagina
        res.redirect(req.get("Referrer") || "/");
    } catch (error) {
        console.error("Error toggling like status:", error);
        res.status(500).send("A server error occurred");
    }
};

app.get('/users-who-liked/:recipeId', authMiddleware, async (req, res) => {
    const recipeId = req.params.recipeId;
    const userId = req.session.userId;  // Haal de ingelogde gebruiker uit de sessie
 
  
    try {
  
      // Zoek gebruikers die het recept hebben geliked
      console.log("Zoekopdracht en filters:", { likes: { $in: [recipeId] } });
      const users = await usersCollection.find({ likes: { $in: [recipeId] } }).toArray();
      console.log(users);
  
      if (!users.length) {
        return res.status(404).send("No users found who liked this recipe");
      }
  
      // Stuur de lijst van gebruikers terug
      res.json(users.map(user => ({
        username: user.username,
      })));
    } catch (error) {
      console.error("Error finding users who liked the recipe:", error);
      res.status(500).send("A server error occurred");
      console.log("Ontvangen recipeId:", recipeId);
    }
  });

////zoekfunctie////
async function fetchFromMongo(collectionRecipes, query = {}, options = {}) {
    try {
        const collection = db.collection(collectionRecipes); // Selecteer de collectie
 
        // Voer de query uit met eventuele opties (bijv. limiet, sortering)
        const results = await collection.find(query, options).toArray();
        return results;
    } catch (error) {
        console.error('Error fetching data from MongoDB:', error);
        throw error; // Gooi de fout opnieuw om deze hogerop te behandelen
    }
}

// Functie om de registratiepagina weer te geven
function createAccount(req, res) {
    res.render('createAccount', {
        errorMessage: '',
        email: '',        
        username: ''      
    });
}
 
function login(req, res) {
    res.render('login', { 
        errorMessage: '' });
}

function logout(req, res) {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Error logging out');
        }
        res.redirect('/login');
        console.log("Logged out!");
    });
}
 
function account(req, res) {
    res.render('account');
}
 
function authMiddleware(req, res, next) {
    if (!req.session || !req.session.userId) {
        console.log("No active session or not logged in, redirecting to login");
        return res.redirect('/login');
    }
    next(); // Gebruiker is ingelogd, ga door naar de volgende functie
}
 
// Functie voor het verwerken van registratiegegevens
async function processRegistration(req, res) {
    let { email, username, password, passwordConfirm } = req.body;

    // Sanitizeer de invoer om XSS-aanvallen te voorkomen
    email = xss(email);
    username = xss(username);
    password = xss(password);
    passwordConfirm = xss(passwordConfirm);

    // Lege array om foutmeldingen op te slaan
    const errors = [];

    if (!validator.isEmail(email)) {
        errors.push('Invalid email address');
    }

    // Valideer wachtwoord
    if (!password || password.length === 0) {
        errors.push('Password cannot be empty');
    } else if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    } else if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    } else if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (password !== passwordConfirm) {
        errors.push('Passwords do not match');
    }

    // Als er fouten zijn, geef ze terug aan de gebruiker
    if (errors.length > 0) {
        return res.render('createAccount', {
            errorMessage: errors.join(', '),
            email: email,       // E-mail wordt doorgegeven
            username: username   // Username wordt doorgegeven
        });
    }

    try {
        // Controleer of e-mail al bestaat
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) return res.render('createAccount', { errorMessage: 'E-mail is al geregistreerd' });

        // Wachtwoord hashen
        const hashedPassword = await bcrypt.hash(password, 10);

        // Voeg gebruiker toe aan database
        await usersCollection.insertOne({ username, email, password: hashedPassword });

        console.log("User created:", { username, email });
        res.redirect('/account');
    } catch (err) {
        console.error("Error during registration:", err);
        res.status(500).send("Server error");
    }
};
 
// Functie voor het verwerken van inloggegevens
async function processLogin(req, res) {
    let { email, password } = req.body;

    // Sanitizeer de invoer om XSS-aanvallen te voorkomen
    email = xss(email);
    password = xss(password);

    const errors = [];

    // Valideer e-mailadres
    if (!validator.isEmail(email)) {
        errors.push('Invalid email address');
    }

    // Valideer wachtwoord
    if (!password || password.length === 0) {
        errors.push('Password cannot be empty');
    }

    // Als er fouten zijn, geef ze terug aan de gebruiker
    if (errors.length > 0) {
        return res.render('login', { errorMessage: errors.join(', ') });
    }

    try {
        // Zoek de gebruiker op e-mail
        const user = await usersCollection.findOne({ email });
        if (!user) {
            return res.render('login', { errorMessage: 'Email not found' });
        }

        // Vergelijk het wachtwoord
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.render('login', { errorMessage: 'Invalid password' });
        }

        // Sla de gebruikersgegevens op in de sessie
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.email = user.email;

        console.log("Session after login:", req.session);

        req.session.save(err => {
            if (err) {
                console.error("Error saving session:", err);
                return res.status(500).send("Session could not be saved.");
            }
            res.redirect('/');
        });

    } catch (err) {
        console.error("Error during login:", err);
        res.status(500).send("Server error");
    }
}

function header(req, res) {
    res.render('header.ejs');
}
 
// 404-foutafhandelingsmiddleware
app.use((req, res) => {
    res.status(404).send("Page not found");
});
 
// 500-foutafhandelingsmiddleware
app.use((err, req, res) => {
    console.error(err.stack);
    res.status(500).send("A server error has occurred!");
});
 
 

 
// search function
 
app.get('/home', async (req, res) => {
    try {
        const searchQuery = req.query.q || ""; // Zoekterm (optioneel)
        const ingredientFilter = req.query.mainingredient; // Hoofdingrediënt filter
        const servingsFilter = req.query.porties; // Aantal porties filter
        const bereidingstijdFilter = req.query.bereidingstijd; // Bereidingstijd filter
     
        console.log("Search query and filters:", req.query);
     
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
        console.log("Built MongoDB query:", JSON.stringify(query, null, 2));
     
        // Haal de recepten op uit de database op basis van de opgestelde query
        const recipes = await usersCollection.find(query).toArray();
     
        // Render de pagina met de recepten (of een bericht als er geen recepten zijn)
        res.render('recipes', {
            recipes,
            message: recipes.length ? "" : "No recipes found.",
            selectedFilters: req.query // Voeg geselecteerde filters door aan de view
        });
     
    } catch (error) {
        console.error("Error while retrieving recipes:", error);
        res.render('recipes', { recipes: [], message: "An error occurred." });
    }
    });