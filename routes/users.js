const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Users = require("../models/User");
const { jwtSecret } = require("../config");
const router = express.Router();
const Joi = require("joi");
const fetchuser = require("../middlewares/fetchuser");

router.post("/login", async (req, res) => {
  const user = await Users.findOne({ email: req.body.email });
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.status(400).json({ errors: "Invalid Credentials" });
  }

  const token = jwt.sign({ user: { id: user.id } }, jwtSecret);
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    })
    .json({ success: true, token });
});

router.post("/signup", async (req, res) => {
  const { error } = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  }).validate(req.body);

  if (error) return res.status(400).send(error.details[0].message);

  if (await Users.findOne({ email: req.body.email })) {
    return res
      .status(400)
      .json({ errors: "existing user found with this email" });
  }

  const hashedPassword = await bcrypt.hash(
    req.body.password,
    await bcrypt.genSalt(10),
  );
  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: hashedPassword,
    cartData: Array(300).fill(0),
  });
  await user.save();

  const token = jwt.sign({ user: { id: user.id } }, jwtSecret);
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    })
    .json({ success: true, token });
});

router.get("/getuser", fetchuser, async (req, res) => {
  const user = await Users.findOne({ _id: req.user.id });
  res.json({ user });
});

module.exports = router;
