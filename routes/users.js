const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Users = require("../models/User"); // Assurez-vous que le chemin est correct
const { jwtSecret } = require("../config");
const router = express.Router(); // Correct way to initialize router

router.post("/login", async (req, res) => {
  try {
    let success = false;
    let user = await Users.findOne({ email: req.body.email });
    if (!user) {
      return res.status(400).json({ success, errors: "Invalid Credentials" });
    }

    const isMatch = await bcrypt.compare(req.body.password, user.password);

    if (!isMatch) {
      return res.status(400).json({ errors: "Invalid Credentials" });
    }

    const data = {
      user: {
        id: user.id,
      },
    };
    const token = jwt.sign(data, jwtSecret);
    res
      .cookie("token", token, {
        httpOnly: true,
        secure: true, // Set to true if using https
        sameSite: "strict",
      })
      .json({ success: true, token });
  } catch (error) {
    console.error(error);
    {
      return res.status(400).json({
        success,
        errors: "Please try with correct email/password",
      });
    }
  }
});

const Joi = require("joi");
const fetchuser = require("../middlewares/fetchuser");

router.post("/signup", async (req, res) => {
  const userSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });

  const { error, value } = userSchema.validate(req.body);

  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  console.log("Sign Up");
  let success = false;
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({
      success: success,
      errors: "existing user found with this email",
    });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }

  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    return res.status(400).json({
      success: false,
      errors: "existing user found with this email",
    });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(req.body.password, salt);

  user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: hashedPassword,
    cartData: cart,
  });
  await user.save();
  const data = {
    user: {
      id: user.id,
    },
  };

  const jwtSecret = process.env.JWT_SECRET;
  const token = jwt.sign(data, jwtSecret);
  success = true;
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: true, // Set to true if using https
      sameSite: "strict",
    })
    .json({ success: true, token });
});

router.get("/getuser", fetchuser, async (req, res) => {
  //fetchuser is a middleware to get the user from the token
  try {
    const userId = req.user.id;
    let user = await Users.findOne({ _id: userId }); //find the user from the database using the id
    res.json({ user }); //send the user data
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
