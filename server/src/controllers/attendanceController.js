
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Class = require("../models/Class");

const validStatuses = ["present", "absent", "late"];

// Validate YYYY-MM-DD and convert it to UTC midnight.
function parseDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    return null;
  }

  return parsed;
}

// Admin can access all students.
// Teacher can access only students in their assigned classes.
async function canAccessStudent(req, student) {
  if (req.user.role === "admin") {
    return true;
  }

  if (req.user.role !== "teacher") {
    return false;
  }

  const assignedClass = await Class.findOne({
    className: student.className,
    section: student.section,
    classTeacher: req.user._id,
  }).select("_id");

  return Boolean(assignedClass);
}

// MARK ATTENDANCE
// Only Admin and assigned Teacher can mark attendance.
const markAttendance = async (req, res) => {
  try {
    const { studentId, date, status } = req.body;

    if (!studentId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: "Student, date and status are required",
      });
    }

    if (!mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be present, absent or late",
      });
    }

    const attendanceDate = parseDate(date);

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid date. Use YYYY-MM-DD format",
      });
    }

    const student = await Student.findOne({
      _id: studentId,
      isActive: true,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Active student not found",
      });
    }

    if (!(await canAccessStudent(req, student))) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this class",
      });
    }

    const attendance = await Attendance.create({
      student: student._id,
      teacher: req.user._id,
      className: student.className,
      section: student.section,
      date: attendanceDate,
      status,
    });

    return res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      attendance,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Attendance already marked for this student and date",
      });
    }

    console.error("Mark attendance error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to mark attendance",
    });
  }
};

// UPDATE ATTENDANCE
// Only Admin and assigned Teacher can update attendance.
const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance ID",
      });
    }

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be present, absent or late",
      });
    }

    const attendance = await Attendance.findById(id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    const student = await Student.findOne({
      _id: attendance.student,
      isActive: true,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Active student not found",
      });
    }

    if (!(await canAccessStudent(req, student))) {
      return res.status(403).json({
        success: false,
        message: "You cannot update this attendance record",
      });
    }

    attendance.status = status;
    attendance.teacher = req.user._id;

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      attendance,
    });
  } catch (error) {
    console.error("Update attendance error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update attendance",
    });
  }
};

// GET ATTENDANCE
// Admin: all records.
// Teacher: records from assigned classes.
// Student: only their own records.
const getAttendance = async (req, res) => {
  try {
    const { date, className, section, studentId } = req.query;
    const filter = {};

    // Optional date filter.
    if (date) {
      const attendanceDate = parseDate(date);

      if (!attendanceDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid date. Use YYYY-MM-DD format",
        });
      }

      const nextDate = new Date(attendanceDate);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);

      filter.date = {
        $gte: attendanceDate,
        $lt: nextDate,
      };
    }

    // Optional class filters.
    if (className) {
      filter.className = className;
    }

    if (section) {
      filter.section = section.toUpperCase();
    }

    if (studentId && !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    // Student can never request another student's records.
    if (req.user.role === "student") {
      if (!req.user.studentProfile) {
        return res.status(403).json({
          success: false,
          message: "Student profile is not linked to this account",
        });
      }

      const ownStudentId = req.user.studentProfile.toString();

      if (studentId && studentId !== ownStudentId) {
        return res.status(403).json({
          success: false,
          message: "You can only view your own attendance",
        });
      }

      filter.student = req.user.studentProfile;
    }

    // Teacher can only view records for assigned classes.
    if (req.user.role === "teacher") {
      if (studentId) {
        filter.student = studentId;
      }

      const assignedClasses = await Class.find({
        classTeacher: req.user._id,
      }).select("className section");

      if (assignedClasses.length === 0) {
        return res.status(200).json({
          success: true,
          count: 0,
          attendance: [],
        });
      }

      const allowedConditions = assignedClasses.map((item) => ({
        className: item.className,
        section: item.section,
      }));

      filter.$and = [
        { $or: allowedConditions },
      ];
    }

    // Admin can view all records or apply the requested filters.
    if (req.user.role === "admin" && studentId) {
      filter.student = studentId;
    }

    const records = await Attendance.find(filter)
      .populate("student", "name rollNumber className section")
      .populate("teacher", "name email")
      .sort({ date: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: records.length,
      attendance: records,
    });
  } catch (error) {
    console.error("Get attendance error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance",
    });
  }
};

module.exports = {
  markAttendance,
  updateAttendance,
  getAttendance,
};
