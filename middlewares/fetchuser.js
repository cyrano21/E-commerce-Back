// middleware/fetchuser.js
const jwt = require("jsonwebtoken");

const fetchuser = (req, res, next) => {
  // Récupère le token de l'en-tête Authorization
  const token = req.header("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token) {
    return res.status(401).json({ error: "Accès refusé, token manquant" });
  }

  try {
    // Vérifie le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Token invalide" });
  }
};

module.exports = fetchuser;
