
const Class = require("../models/Class");
const User = require("../models/User");
const mongoose = require("mongoose");

const validId = (id) => mongoose.isValidObjectId(id);

const getTeacher = async (teacherId) => {
  if (!teacherId) return null;

  if (!validId(teacherId)) {
    const error = new Error("Invalid teacher ID");
    error.statusCode = 400;
    throw error;
  }

  const teacher = await User.findOne({
    _id: teacherId,
    role: "teacher",
  });

  if (!teacher) {
    const error = new Error("Valid teacher not found");
    error.statusCode = 400;
    throw error;
  }

  return teacher;
};

const syncTeacherAssignment = async (schoolClass, newTeacherId) => {
  const oldTeacherId = schoolClass.classTeacher
    ? schoolClass.classTeacher.toString()
    : null;

  const newId = newTeacherId ? newTeacherId.toString() : null;

  if (oldTeacherId === newId) return;

  if (newId) {
    const otherClass = await Class.findOne({
      classTeacher: newTeacherId,
      _id: { $ne: schoolClass._id },
    });

    if (otherClass) {
      const error = new Error(
        "This teacher is already assigned to another class"
      );
      error.statusCode = 409;
      throw error;
    }
  }

  if (oldTeacherId) {
    await User.updateOne(
      { _id: oldTeacherId, role: "teacher", assignedClass: schoolClass._id },
      { $set: { assignedClass: null } }
    );
  }

  if (newId) {
    await User.updateOne(
      { _id: newId, role: "teacher" },
      { $set: { assignedClass: schoolClass._id } }
    );
  }

  schoolClass.classTeacher = newTeacherId || null;
};

const createClass = async (req, res) => {
  try {
    const { className, section, classTeacher } = req.body;

    if (
      typeof className !== "string" ||
      !className.trim() ||
      typeof section !== "string" ||
      !section.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Class name and section are required",
      });
    }

    const teacher = await getTeacher(classTeacher || null);

    if (teacher?.assignedClass) {
      return res.status(409).json({
        success: false,
        message: "This teacher is already assigned to another class",
      });
    }

    const newClass = await Class.create({
      className: className.trim(),
      section: section.trim().toUpperCase(),
      classTeacher: teacher?._id || null,
      createdBy: req.user._id,
    });

    if (teacher) {
      teacher.assignedClass = newClass._id;
      await teacher.save();
    }

    await newClass.populate("classTeacher", "name email");

    return res.status(201).json({
      success: true,
      message: "Class created successfully",
      class: newClass,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This class and section already exists",
      });
    }

    console.error("Create class error:", error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create class",
    });
  }
};


const getClasses = async (req, res) => {
  try {
    let query = {};

    // Teachers can view only their assigned class.
    if (req.user.role === "teacher") {
      query.classTeacher = req.user._id;
    }

    const classes = await Class.find(query)
      .populate("classTeacher", "name email phone subject")
      .sort({ className: 1, section: 1 });

    return res.status(200).json({
      success: true,
      count: classes.length,
      classes,
    });
  } catch (error) {
    console.error("Get classes error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch classes",
    });
  }
};
;

const updateClass = async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class ID",
      });
    }

    const existingClass = await Class.findById(req.params.id);

    if (!existingClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    const { className, section, classTeacher } = req.body;

    if (className !== undefined) {
      if (typeof className !== "string" || !className.trim()) {
        return res.status(400).json({
          success: false,
          message: "Class name cannot be empty",
        });
      }

      existingClass.className = className.trim();
    }

    if (section !== undefined) {
      if (typeof section !== "string" || !section.trim()) {
        return res.status(400).json({
          success: false,
          message: "Section cannot be empty",
        });
      }

      existingClass.section = section.trim().toUpperCase();
    }

    if (classTeacher !== undefined) {
      const teacher = await getTeacher(classTeacher || null);
      await syncTeacherAssignment(existingClass, teacher?._id || null);
    }

    await existingClass.save();
    await existingClass.populate("classTeacher", "name email phone subject");

    return res.status(200).json({
      success: true,
      message: "Class updated successfully",
      class: existingClass,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This class and section already exists",
      });
    }

    console.error("Update class error:", error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update class",
    });
  }
};

const deleteClass = async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class ID",
      });
    }

    const existingClass = await Class.findById(req.params.id);

    if (!existingClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    if (existingClass.classTeacher) {
      await User.updateOne(
        {
          _id: existingClass.classTeacher,
          role: "teacher",
          assignedClass: existingClass._id,
        },
        { $set: { assignedClass: null } }
      );
    }

    await existingClass.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Class deleted successfully",
    });
  } catch (error) {
    console.error("Delete class error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete class",
    });
  }
};

module.exports = {
  createClass,
  getClasses,
  updateClass,
  deleteClass,
};
