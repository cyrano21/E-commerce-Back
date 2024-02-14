// index.js
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./db");

const app = express();
connectDB(); // Initialise la connexion à la base de données

app.use(express.json());
app.set("trust proxy", true);

app.use(cors({ origin: true, credentials: true }));

const userRoutes = require("./routes/users");
const productRoutes = require("./routes/products");
const salesRoutes = require("./routes/sales");

app.use("/users", userRoutes);
app.use("/products", productRoutes);
app.use("/sales", salesRoutes);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par `window` (ici, 15 minutes)
});
app.use(limiter);

app.get("/", (req, res) => res.send("Welcome to the API"));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running on port ${port}`));
