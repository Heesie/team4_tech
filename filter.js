
const dotenv = require('dotenv')
dotenv.config();

const express = require('express');
const app = express();

app.set('view engine', 'ejs'); // Voegt toe dat we met ejs werken
app.use('/static', express.static('static'));


app
  .get('/', filter) // Gebruik de filter functie voor de home route
  .listen(3000, () => console.log(":De server draait bitchhhhh"));

function filter(req, res) {
  res.render('filter'); // Gebruik res.render() om de EJS-pagina te renderen
}


 