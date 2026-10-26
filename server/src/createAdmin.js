
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function createAdmin() {
  try {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI } = process.env;

    if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || !MONGODB_URI) {
      throw new Error(
        "Set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, and MONGODB_URI before creating an admin"
      );
    }

    if (ADMIN_PASSWORD.length < 6) {
      throw new Error("ADMIN_PASSWORD must contain at least 6 characters");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const email = ADMIN_EMAIL.trim().toLowerCase();

    if (await User.exists({ email })) {
      throw new Error(`An account already exists for ${email}`);
    }

    await User.create({
      name: ADMIN_NAME.trim(),
      email,
      password: ADMIN_PASSWORD,
      role: "admin",
    });
    console.log(`Admin account created for ${email}`);
  } catch (error) {
    console.error("Admin creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

createAdmin();
