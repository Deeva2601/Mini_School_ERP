
const mongoose = require("mongoose");

const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });

    console.log("MongoDB connected successfully!");
    console.log("Database:", mongoose.connection.name);
  } catch (error) {
  console.error("MongoDB error name:", error.name);
  console.error("MongoDB error code:", error.code);
  console.error("MongoDB error message:", error.message);
  process.exit(1);
}
};

module.exports = connectDatabase;
