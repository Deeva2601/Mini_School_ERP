
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function resetAdminPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected!");

    const email = "admin@school.com";
    const newPassword = "Admin@12345";

    const admin = await User.findOne({ email }).select("+password");

    if (!admin) {
      console.log("Admin account not found.");
      return;
    }

    admin.password = newPassword;
    await admin.save();

    console.log("Admin password reset successfully!");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

resetAdminPassword();
