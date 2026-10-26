
const express = require("express");
const router = express.Router();

const {
  markAttendance,
  updateAttendance,
  getAttendance,
} = require("../controllers/attendanceController");

const {
  protect,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// All attendance routes require login.
router.use(protect);

// Admin, Teacher and Student can view attendance.
// Their data access is restricted in attendanceController.js.
router.get(
  "/",
  authorizeRoles("admin", "teacher", "student"),
  getAttendance
);

// Only Admin and Teacher can mark attendance.
router.post(
  "/",
  authorizeRoles("admin", "teacher"),
  markAttendance
);

// Only Admin and Teacher can update attendance.
router.put(
  "/:id",
  authorizeRoles("admin", "teacher"),
  updateAttendance
);

module.exports = router;
