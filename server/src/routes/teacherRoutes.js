
const express = require("express");

const {
  createTeacher,
  getTeachers,
  updateTeacher,
  deleteTeacher,
} = require("../controllers/teacherController");

const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// All routes require Admin authentication
router.use(protect, authorizeRoles("admin"));

router.post("/", createTeacher);
router.get("/", getTeachers);
router.put("/:id", updateTeacher);
router.delete("/:id", deleteTeacher);

module.exports = router;
