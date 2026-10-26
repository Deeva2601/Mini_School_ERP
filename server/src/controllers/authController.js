
const User = require("../models/User");
const Student = require("../models/Student");
const jwt = require("jsonwebtoken");

const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

const allowedRoles = ["admin", "teacher", "student"];

if (!["admin", "teacher", "student"].includes(role)) {
  return res.status(400).json({
    success: false,
    message: "Please select a valid login role.",
  });
}

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.role !== role) {
  return res.status(403).json({
    success: false,
    message: "This account does not belong to the selected role",
  });
}

    // A Student login must be linked to an active Student record.
    if (user.role === "student") {
      if (!user.studentProfile) {
        return res.status(403).json({
          success: false,
          message: "Student profile is not linked to this account",
        });
      }

      const student = await Student.findOne({
        _id: user.studentProfile,
        isActive: true,
      }).select("_id");

      if (!student) {
        return res.status(403).json({
          success: false,
          message: "Active student profile not found",
        });
      }
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ...(user.role === "student" && {
          studentProfile: user.studentProfile,
        }),
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

module.exports = { login };
