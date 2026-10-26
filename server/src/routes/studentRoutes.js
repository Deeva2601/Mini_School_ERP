
const express = require("express");
const router = express.Router();

const {
  createStudent,
  getStudents,
  updateStudent,
  deleteStudent,
  getMyStudentProfile,
} = require("../controllers/studentController");

const {
  protect,
  authorizeRoles,
} = require("../middleware/authMiddleware");

router.use(protect);

// Student can access only their own profile
router.get("/me", authorizeRoles("student"), getMyStudentProfile);

// Student management
router.post("/", authorizeRoles("admin"), createStudent);
router.get("/", authorizeRoles("admin", "teacher"), getStudents);
router.put("/:id", authorizeRoles("admin"), updateStudent);
router.delete("/:id", authorizeRoles("admin"), deleteStudent);

module.exports = router;
