
const express = require("express");

const {
  createClass,
  getClasses,
  updateClass,
  deleteClass,
} = require("../controllers/classController");

const {
  protect,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

// Admin and Teacher can view classes.
// Only Admin can create, update, or delete classes.
router.get("/", authorizeRoles("admin", "teacher"), getClasses);

router.post("/", authorizeRoles("admin"), createClass);
router.put("/:id", authorizeRoles("admin"), updateClass);
router.delete("/:id", authorizeRoles("admin"), deleteClass);

module.exports = router;
