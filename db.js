const mongoose = require("mongoose");
const { mongooseURL } = require("./config");

const connectDB = async () => {
  try {
    await mongoose.connect(mongooseURL);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Error connecting to MongoDB", err);
    process.exit(1);
  }
};

module.exports = connectDB;
