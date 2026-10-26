
const mongoose = require("mongoose");
const Student = require("../models/Student");
const User = require("../models/User");
const Class = require("../models/Class");

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Create a student and optionally create a linked login account.
const createStudent = async (req, res) => {
  let createdStudent = null;
  let createdUser = null;

  try {
    const {
      name,
      rollNumber,
      className,
      section,
      email = "",
      guardianContact = "",
      loginPassword,
    } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !String(rollNumber ?? "").trim() ||
      typeof className !== "string" ||
      !className.trim() ||
      typeof section !== "string" ||
      !section.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, roll number, class and section are required",
      });
    }

    if (
      typeof email !== "string" ||
      typeof guardianContact !== "string" ||
      (loginPassword !== undefined && typeof loginPassword !== "string")
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid email, guardian contact, or login password",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = loginPassword || "";

    if (normalizedPassword && !normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Email is required to create a student login account",
      });
    }

    if (normalizedPassword && normalizedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Login password must contain at least 6 characters",
      });
    }

    if (normalizedPassword) {
      const existingUser = await User.findOne({
        email: normalizedEmail,
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists",
        });
      }
    }

    const schoolClass = await Class.findOne({
      className: className.trim(),
      section: section.trim().toUpperCase(),
    }).select("_id");

    if (!schoolClass) {
      return res.status(400).json({
        success: false,
        message: "Select an existing class and section",
      });
    }

    createdStudent = await Student.create({
      name: name.trim(),
      rollNumber: String(rollNumber).trim(),
      className: className.trim(),
      section: section.trim().toUpperCase(),
      schoolClass: schoolClass._id,
      email: normalizedEmail,
      guardianContact: guardianContact.trim(),
    });

    if (normalizedPassword) {
      createdUser = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: normalizedPassword,
        role: "student",
        studentProfile: createdStudent._id,
      });
    }

    return res.status(201).json({
      success: true,
      message: createdUser
        ? "Student and login account created successfully"
        : "Student created successfully",
      student: createdStudent,
      loginAccountCreated: Boolean(createdUser),
    });
  } catch (error) {
    if (createdUser) {
      await User.deleteOne({ _id: createdUser._id }).catch(() => {});
    }

    if (createdStudent) {
      await Student.deleteOne({ _id: createdStudent._id }).catch(() => {});
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Roll number already exists in this class and section, or email is already in use",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create student error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create student",
    });
  }
};

// Get active students. Teachers can see only their assigned classes.
const getStudents = async (req, res) => {
  try {
    const { className, section, search } = req.query;
    const filter = { isActive: true };

    if (req.user.role === "teacher") {
      const assignedClasses = await Class.find({
        classTeacher: req.user._id,
      }).select("className section");

      if (assignedClasses.length === 0) {
        return res.status(200).json({
          success: true,
          count: 0,
          students: [],
        });
      }

      const allowedClasses = assignedClasses.map((item) => ({
        className: item.className,
        section: item.section,
      }));

      filter.$or = allowedClasses;
    }

    if (className?.trim()) {
      filter.className = className.trim();
    }

    if (section?.trim()) {
      filter.section = section.trim().toUpperCase();
    }

    if (search?.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), "i");

      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { name: regex },
            { rollNumber: regex },
            { email: regex },
            { guardianContact: regex },
          ],
        },
      ];
    }

    const students = await Student.find(filter).sort({
      className: 1,
      section: 1,
      rollNumber: 1,
    });

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("Get students error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch students",
    });
  }
};

// A student can retrieve only their own linked profile.
const getMyStudentProfile = async (req, res) => {
  try {
    if (req.user.role !== "student" || !req.user.studentProfile) {
      return res.status(403).json({
        success: false,
        message: "No student profile is linked to this account",
      });
    }

    const student = await Student.findOne({
      _id: req.user.studentProfile,
      isActive: true,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Active student profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    console.error("Get own student profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student profile",
    });
  }
};

// Update a student and synchronize the linked account.
const updateStudent = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(req.params.id);

    if (!student || !student.isActive) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const {
      name,
      rollNumber,
      className,
      section,
      email,
      guardianContact,
    } = req.body;

    const nextClassName =
      className === undefined ? student.className : className;
    const nextSection =
      section === undefined ? student.section : section;

    if (
      typeof nextClassName !== "string" ||
      !nextClassName.trim() ||
      typeof nextSection !== "string" ||
      !nextSection.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Class and section cannot be empty",
      });
    }

    const schoolClass = await Class.findOne({
      className: nextClassName.trim(),
      section: nextSection.trim().toUpperCase(),
    }).select("_id");

    if (!schoolClass) {
      return res.status(400).json({
        success: false,
        message: "Select an existing class and section",
      });
    }

    student.className = nextClassName.trim();
    student.section = nextSection.trim().toUpperCase();
    student.schoolClass = schoolClass._id;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }
      student.name = name.trim();
    }

    if (rollNumber !== undefined) {
      if (!String(rollNumber).trim()) {
        return res.status(400).json({
          success: false,
          message: "Roll number cannot be empty",
        });
      }
      student.rollNumber = String(rollNumber).trim();
    }

    if (email !== undefined) {
      if (typeof email !== "string") {
        return res.status(400).json({
          success: false,
          message: "Email must be a string",
        });
      }
      student.email = email.trim().toLowerCase();
    }

    if (guardianContact !== undefined) {
      if (typeof guardianContact !== "string") {
        return res.status(400).json({
          success: false,
          message: "Guardian contact must be a string",
        });
      }
      student.guardianContact = guardianContact.trim();
    }

    const linkedUser = await User.findOne({
      studentProfile: student._id,
      role: "student",
    });

    if (linkedUser) {
      const nextEmail = student.email.trim().toLowerCase();

      if (!nextEmail) {
        return res.status(400).json({
          success: false,
          message: "A linked student login must have an email address",
        });
      }

      const emailInUse = await User.findOne({
        email: nextEmail,
        _id: { $ne: linkedUser._id },
      });

      if (emailInUse) {
        return res.status(409).json({
          success: false,
          message: "This email is already used by another account",
        });
      }

      linkedUser.email = nextEmail;
      linkedUser.name = student.name;
    }

    await student.save();

    if (linkedUser) {
      await linkedUser.save();
    }

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      student,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Roll number already exists in this class and section, or email is already in use",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Update student error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update student",
    });
  }
};

// Deactivate the student and remove their linked login account.
const deleteStudent = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(req.params.id);

    if (!student || !student.isActive) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    student.isActive = false;
    await student.save();

    await User.deleteOne({
      studentProfile: student._id,
      role: "student",
    });

    return res.status(200).json({
      success: true,
      message: "Student deactivated successfully",
    });
  } catch (error) {
    console.error("Delete student error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate student",
    });
  }
};

module.exports = {
  createStudent,
  getStudents,
  getMyStudentProfile,
  updateStudent,
  deleteStudent,
};
