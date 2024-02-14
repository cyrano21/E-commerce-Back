const mongoose = require("mongoose");
const { mongooseURL } = require("./config");

const connectDB = async () => {
  try {
    await mongoose.connect(mongooseURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Error connecting to MongoDB", err);
  }
};

module.exports = { connectDB };
