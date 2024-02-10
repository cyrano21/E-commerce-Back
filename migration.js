// migration.js


require('dotenv').config();
const mongoose = require("mongoose");
const Product = require("./models/Product"); // ajustez le chemin vers votre modèle de produit

const mongooseURL = process.env.MONGOOSE_URL; // assurez-vous que cela pointe vers votre base de données

mongoose.connect(mongooseURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

mongoose.connection.once("open", async () => {
    console.log("Connected to MongoDB");
    try {
        // Mise à jour de toutes les catégories pour les mettre en majuscules
        const result = await Product.updateMany(
            {},
            [{ $set: { category: { $toUpper: "$category" } } }]
        );
        console.log("Categories updated:", result);
        mongoose.connection.close();
    } catch (error) {
        console.error("Error updating categories:", error);
        mongoose.connection.close();
    }
});
