const jwt = require("jsonwebtoken");

const fetchuser = (req, res, next) => {
  // Récupérer le token du header de la requête
  const token = req.header("auth-token");
  if (!token) {
    return res
      .status(401)
      .send({ error: "Veuillez vous authentifier avec un token valide." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user; // Ajouter l'utilisateur au requête pour un accès dans les routes suivantes
    next();
  } catch (error) {
    res.status(401).send({ error: "Token invalide." });
  }
};
module.exports = fetchuser;
