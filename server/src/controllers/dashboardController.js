
const User = require("../models/User");
const Student = require("../models/Student");
const Class = require("../models/Class");
const Attendance = require("../models/Attendance");

const getDashboardStats = async (req, res) => {
  try {
    // Use India local date (IST) consistently.
    const now = new Date();
    const indiaDate = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const year = indiaDate.getFullYear();
    const month = String(indiaDate.getMonth() + 1).padStart(2, "0");
    const day = String(indiaDate.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;

    // Convert IST midnight to UTC for MongoDB date queries.
    const today = new Date(`${dateKey}T00:00:00+05:30`);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const [
      totalTeachers,
      totalStudents,
      totalClasses,
      attendanceSummary,
    ] = await Promise.all([
      User.countDocuments({ role: "teacher" }),
      Student.countDocuments({ isActive: true }),
      Class.countDocuments({}),
      Attendance.aggregate([
        {
          $match: {
            date: { $gte: today, $lt: tomorrow },
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const summary = {
      presentToday: 0,
      absentToday: 0,
      lateToday: 0,
    };

    for (const item of attendanceSummary) {
      if (item._id === "present") summary.presentToday = item.count;
      if (item._id === "absent") summary.absentToday = item.count;
      if (item._id === "late") summary.lateToday = item.count;
    }

    const todayAttendance =
      summary.presentToday +
      summary.absentToday +
      summary.lateToday;

    const notMarkedToday = Math.max(
      0,
      totalStudents - todayAttendance
    );

    const attendancePercentage =
      totalStudents > 0
        ? Number(((todayAttendance / totalStudents) * 100).toFixed(1))
        : 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalTeachers,
        totalStudents,
        totalClasses,
        todayAttendance,
        presentToday: summary.presentToday,
        absentToday: summary.absentToday,
        lateToday: summary.lateToday,
        notMarkedToday,
        attendancePercentage,
        date: dateKey,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
    });
  }
};

module.exports = { getDashboardStats };
