
const mongoose = require("mongoose");
const User = require("../models/User");
const SchoolClass = require("../models/Class");

// Fields returned to the frontend
const teacherFields = "name email role phone subject assignedClass createdAt";

const formatTeacher = (teacher) => ({
  id: teacher._id,
  name: teacher.name,
  email: teacher.email,
  role: teacher.role,
  phone: teacher.phone || "",
  subject: teacher.subject || "",
  assignedClass: teacher.assignedClass || null,
  createdAt: teacher.createdAt,
});

const assignClass = async (teacher, classId) => {
  if (classId === undefined) return;

  if (classId === null || classId === "") {
    if (teacher.assignedClass) {
      await SchoolClass.updateOne(
        { _id: teacher.assignedClass, classTeacher: teacher._id },
        { $set: { classTeacher: null } }
      );
    }

    teacher.assignedClass = null;
    return;
  }

  if (!mongoose.isValidObjectId(classId)) {
    const error = new Error("Invalid class ID");
    error.statusCode = 400;
    throw error;
  }

  const targetClass = await SchoolClass.findById(classId);

  if (!targetClass) {
    const error = new Error("Class not found");
    error.statusCode = 404;
    throw error;
  }

  // Do not silently replace another class teacher.
  if (
    targetClass.classTeacher &&
    targetClass.classTeacher.toString() !== teacher._id.toString()
  ) {
    const error = new Error("This class already has a class teacher");
    error.statusCode = 409;
    throw error;
  }

  // Release the teacher's previous class, if any.
  if (
    teacher.assignedClass &&
    teacher.assignedClass.toString() !== classId
  ) {
    await SchoolClass.updateOne(
      { _id: teacher.assignedClass, classTeacher: teacher._id },
      { $set: { classTeacher: null } }
    );
  }

  targetClass.classTeacher = teacher._id;
  await targetClass.save();

  teacher.assignedClass = targetClass._id;
};

// Create teacher
const createTeacher = async (req, res) => {
  try {
    const { name, email, password, phone = "", subject = "", assignedClass = null } = req.body;

    if (
      typeof name !== "string" || !name.trim() ||
      typeof email !== "string" || !email.trim() ||
      typeof password !== "string" || password.length < 6
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid name, email and password (at least 6 characters) are required",
      });
    }

    if (typeof phone !== "string" || typeof subject !== "string") {
      return res.status(400).json({
        success: false,
        message: "Phone and subject must be text",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    const teacher = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: "teacher",
      phone: phone.trim(),
      subject: subject.trim(),
      assignedClass: null,
    });

    await assignClass(teacher, assignedClass);
    await teacher.save();

    return res.status(201).json({
      success: true,
      message: "Teacher created successfully",
      teacher: formatTeacher(teacher),
    });
  } catch (error) {
    console.error("Create teacher error:", error.message);

    return res.status(error.statusCode || (error.code === 11000 ? 409 : 500)).json({
      success: false,
      message: error.code === 11000 ? "Email already exists" : error.message || "Failed to create teacher",
    });
  }
};

// Get all teachers
const getTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ role: "teacher" })
      .select(teacherFields)
      .populate("assignedClass", "className section")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: teachers.length,
      teachers: teachers.map((teacher) => ({
        ...formatTeacher(teacher),
        assignedClass: teacher.assignedClass
          ? {
              id: teacher.assignedClass._id,
              className: teacher.assignedClass.className,
              section: teacher.assignedClass.section,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Get teachers error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch teachers",
    });
  }
};

// Update teacher
const updateTeacher = async (req, res) => {
  try {
    const { name, email, password, phone, subject, assignedClass } = req.body;

    const teacher = await User.findOne({
      _id: req.params.id,
      role: "teacher",
    });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }
      teacher.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({
          success: false,
          message: "Email cannot be empty",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: teacher._id },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }

      teacher.email = normalizedEmail;
    }

    if (password !== undefined) {
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }
      teacher.password = password;
    }

    if (phone !== undefined) {
      if (typeof phone !== "string") {
        return res.status(400).json({
          success: false,
          message: "Phone must be text",
        });
      }
      teacher.phone = phone.trim();
    }

    if (subject !== undefined) {
      if (typeof subject !== "string") {
        return res.status(400).json({
          success: false,
          message: "Subject must be text",
        });
      }
      teacher.subject = subject.trim();
    }

    await assignClass(teacher, assignedClass);
    await teacher.save();

    return res.status(200).json({
      success: true,
      message: "Teacher updated successfully",
      teacher: formatTeacher(teacher),
    });
  } catch (error) {
    console.error("Update teacher error:", error.message);

    return res.status(error.statusCode || (error.code === 11000 ? 409 : 500)).json({
      success: false,
      message: error.code === 11000 ? "Email already exists" : error.message || "Failed to update teacher",
    });
  }
};

// Delete teacher and release their assigned class
const deleteTeacher = async (req, res) => {
  try {
    const teacher = await User.findOne({
      _id: req.params.id,
      role: "teacher",
    });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    if (teacher.assignedClass) {
      await SchoolClass.updateOne(
        { _id: teacher.assignedClass, classTeacher: teacher._id },
        { $set: { classTeacher: null } }
      );
    }

    await teacher.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Teacher deleted successfully",
    });
  } catch (error) {
    console.error("Delete teacher error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete teacher",
    });
  }
};

module.exports = {
  createTeacher,
  getTeachers,
  updateTeacher,
  deleteTeacher,
};
