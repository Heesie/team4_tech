# team4_tech1


# **Project Documentation**


## **Project Overview**


Dit project is een webapplicatie die gebruik maakt van Node.js, Express, en MongoDB voor het beheren van recepten en gebruikersaccounts. Het stelt gebruikers in staat om recepten te bekijken, hun favoriete recepten te bewaren, en gebruikersaccounts aan te maken of in te loggen.


## **Technische Specificaties**


### **Stack**
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (via MongoDB Atlas)
- **Authentication**: Sessions (met `express-session`)
- **Password Management**: bcryptjs (voor het hashen van wachtwoorden)
- **Sanitization**: xss (om Cross-Site Scripting-aanvallen te voorkomen)
- **Validation**: validator (voor validatie van invoer)
- **Session Management**: Gebruikt `express-session` voor sessiebeheer en het opslaan van gebruikersgegevens.


### **Architectuur**
De applicatie maakt gebruik van een **Model-View-Controller (MVC)**-structuur:
- **Model**: MongoDB database (met collecties voor recepten en gebruikers)
- **View**: Dynamische pagina’s gemaakt met EJS (Embedded JavaScript).
- **Controller**: Express-routes die de logica afhandelen voor het weergeven van pagina's en het interactief verwerken van gegevens.


### **Milieuconfiguratie**
De database-verbinding en sessieconfiguratie worden beheerd via een `.env` bestand:
- `DB_USERNAME`: Gebruikersnaam voor MongoDB.
- `DB_PASSWORD`: Wachtwoord voor MongoDB.
- `DB_HOST`: Hostnaam voor de MongoDB-database.
- `DB_NAME`: Naam van de MongoDB-database.
- `SESSION_SECRET`: Een geheime sleutel voor het versleutelen van sessies.


---


## **Belangrijke Functies**


### **1. Gebruikersbeheer**
- **Registratie**: Gebruikers kunnen een account aanmaken door hun e-mailadres, gebruikersnaam en wachtwoord in te voeren. Het wachtwoord wordt gehashed voordat het in de database wordt opgeslagen.
- **Inloggen**: Gebruikers kunnen inloggen met hun e-mailadres en wachtwoord. Het wachtwoord wordt vergeleken met het gehashte wachtwoord in de database.
- **Uitloggen**: Gebruikers kunnen uitloggen, wat hun sessie verwijdert.
- **Sessiebeheer**: Gebruikersgegevens zoals `userId`, `username`, en `email` worden opgeslagen in de sessie voor eenvoudig toegang tijdens het navigeren door de applicatie.


### **2. Receptbeheer**
- **Weergave van recepten**: Gebruikers kunnen recepten doorzoeken en filteren op verschillende parameters zoals naam, ingrediënten, bereidingstijd, en aantal porties.
- **Favorieten**: Gebruikers kunnen recepten als favoriet markeren, wat wordt opgeslagen in hun gebruikersprofiel.
- **Receptdetails**: Gebruikers kunnen de gedetailleerde informatie van een recept bekijken door op een recept te klikken.


### **3. Favorietenbeheer**
- Gebruikers kunnen hun favoriete recepten in hun accountbeheerpagina bekijken.
- Favorieten worden opgeslagen in de gebruikerscollectie in de MongoDB-database.


### **4. Search Functionaliteit**
- De applicatie biedt een zoekfunctie die gebruikers in staat stelt recepten te zoeken op basis van naam, ingrediënten, of andere filters.
- Zoekresultaten worden gefilterd met behulp van reguliere expressies (regex) in MongoDB.


---


## ** Aanbevelingen voor Optimalisatie**

### **1. MongoDB Zoekopdrachten**

Paging en Limiting: Om de prestaties van zoekopdrachten te verbeteren, kan het helpen om de zoekresultaten op te splitsen in pagina's (bijvoorbeeld, 10 recepten per pagina). Dit voorkomt dat de app traag wordt bij het laden van grote hoeveelheden gegevens.

### **2. Beveiliging en Validatie**

Wachtwoordbeveiliging: De huidige wachtwoordbeveiliging is goed, maar kan verbeterd worden door extra regels toe te voegen. Denk hierbij aan het verplichten van speciale tekens in wachtwoorden of het tonen van een wachtwoordsterktebeoordeling om gebruikers te helpen veilige wachtwoorden te kiezen.


---


## **Testresultaten en Inzichten voor Toekomstige Iteraties**

### **1. Teststrategie**
De teststrategie bestond uit het afnemen van interviews en het opstellen van een testplan.

### **2. Testresultaten en Inzichten voor Toekomstige Iteraties**

De tests gaven waardevolle inzichten in de gebruiksvriendelijkheid van de app. Testers konden eenvoudig recepten toevoegen aan favorieten, zoeken en filteren. Positieve feedback was er over het ontwerp en de kleuren. 

Verbeterpunten waren onder andere:
- Duidelijkere wachtwoordvereisten bij het aanmaken van een account.
- Het toevoegen van een vegetarisch filter in de zoekfunctie.
- Het verbeteren van pop-ups die verschijnen bij het liken van recepten.

Daarnaast werd er aangegeven dat het toevoegen van informatie zoals bereidingstijd en het aantal personen per recept op de recept cards nuttig zou zijn.

Deze feedback biedt handvatten voor verbeteringen in toekomstige versies van de app.

 ---


## **Conclusie en Toekomstige Richtingen**


De applicatie is goed opgebouwd en heeft veel handige functies, maar er zijn nog verbeterpunten voor de prestaties. Toekomstige versies kunnen zich richten op het sneller maken van zoekopdrachten in de database en het verbeteren van de gebruikerservaring. Bijvoorbeeld door een real-time systeem toe te voegen voor het beheren van favorieten en recepten.