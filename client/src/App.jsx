
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "";

const initialStats = {
  totalTeachers: 0,
  totalStudents: 0,
  totalClasses: 0,
  todayAttendance: 0,
  presentToday: 0,
  absentToday: 0,
  lateToday: 0,
  classAttendance: [],
};

const adminMenuItems = [
  { name: "Dashboard", icon: "▦" },
  { name: "Teachers", icon: "♙" },
  { name: "Students", icon: "♧" },
  { name: "Classes", icon: "▤" },
  { name: "Attendance", icon: "✓" },
];

const teacherMenuItems = [
  { name: "Dashboard", icon: "▦" },
  { name: "Attendance", icon: "✓" },
];

const studentMenuItems = [
  { name: "Dashboard", icon: "▦" },
  { name: "Attendance", icon: "✓" },
];

const emptyTeacher = {
  name: "",
  email: "",
  password: "",
  phone: "",
  subject: "",
  assignedClass: "",
};

const emptyClass = {
  className: "",
  section: "",
  classTeacher: "",
};

const emptyStudent = {
  name: "",
  rollNumber: "",
  className: "",
  section: "",
  email: "",
  guardianContact: "",
  loginPassword: "",
};

function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("schoolToken");

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    localStorage.removeItem("schoolToken");
    localStorage.removeItem("schoolUser");
    window.location.reload();
    throw new Error("Your session expired. Please sign in again.");
  }

  if (response.status === 403) {
    throw new Error(data.message || "You do not have permission.");
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }

  return data;
}

function recordId(record) {
  return String(record?._id || record?.id || "");
}

function assignedClassId(teacher) {
  const value = teacher?.assignedClass;
  return typeof value === "object" && value !== null
    ? recordId(value)
    : String(value || "");
}

function getStudentId(record) {
  const student = record?.student || record?.studentId;
  return typeof student === "object" && student !== null
    ? recordId(student)
    : String(student || "");
}

function getRecords(data) {
  return data.attendance || data.records || [];
}

function classQuery(schoolClass) {
  return new URLSearchParams({
    className: schoolClass.className,
    section: schoolClass.section,
  });
}

export default function App() {
  const [page, setPage] = useState("Dashboard");

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("schoolUser")) || null;
    } catch {
      return null;
    }
  });

  const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [role, setRole] = useState("admin");
const [showPassword, setShowPassword] = useState(false);
const [error, setError] = useState("");
const [loginLoading, setLoginLoading] = useState(false);

  const [stats, setStats] = useState(initialStats);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [myStudentProfile, setMyStudentProfile] = useState(null);

  const [teacherForm, setTeacherForm] = useState(emptyTeacher);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [showTeacherForm, setShowTeacherForm] = useState(false);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherSaving, setTeacherSaving] = useState(false);
  const [teacherError, setTeacherError] = useState("");
  const [teacherMessage, setTeacherMessage] = useState("");

  const [classForm, setClassForm] = useState(emptyClass);
  const [editingClassId, setEditingClassId] = useState(null);
  const [showClassForm, setShowClassForm] = useState(false);
  const [classLoading, setClassLoading] = useState(false);
  const [classSaving, setClassSaving] = useState(false);
  const [classError, setClassError] = useState("");
  const [classMessage, setClassMessage] = useState("");

  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentSaving, setStudentSaving] = useState(false);
  const [studentError, setStudentError] = useState("");
  const [studentMessage, setStudentMessage] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentClassFilter, setStudentClassFilter] = useState("");
  const [studentSectionFilter, setStudentSectionFilter] = useState("");

  const [attendanceDate, setAttendanceDate] = useState(todayString());
  const [attendanceClassId, setAttendanceClassId] = useState("");
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceStudents, setAttendanceStudents] = useState([]);
  const [attendanceMarks, setAttendanceMarks] = useState({});
  const [attendanceHistoryLoading, setAttendanceHistoryLoading] =
    useState(false);
  const [attendanceStudentsLoading, setAttendanceStudentsLoading] =
    useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceMessage, setAttendanceMessage] = useState("");
  const [attendanceMode, setAttendanceMode] = useState("mark");

  // Request IDs prevent older responses from replacing newer filter results.
  const requestIds = useRef({});
  const attendanceSaveLock = useRef(false);

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const isStudent = user?.role === "student";

  const visibleMenuItems = isAdmin
    ? adminMenuItems
    : isTeacher
      ? teacherMenuItems
      : studentMenuItems;

  const attendanceLoading =
    attendanceHistoryLoading || attendanceStudentsLoading;

  const nextRequestId = (key) => {
    requestIds.current[key] = (requestIds.current[key] || 0) + 1;
    return requestIds.current[key];
  };

  // DASHBOARD

  const loadDashboard = useCallback(async () => {
    if (user?.role !== "admin") return;

    const requestId = nextRequestId("dashboard");
    setDashboardLoading(true);
    setError("");

    try {
      const data = await apiRequest("/api/dashboard");

      if (requestIds.current.dashboard === requestId) {
        setStats({ ...initialStats, ...(data.stats || {}) });
      }
    } catch (err) {
      if (requestIds.current.dashboard === requestId) {
        setError(err.message || "Dashboard could not load.");
      }
    } finally {
      if (requestIds.current.dashboard === requestId) {
        setDashboardLoading(false);
      }
    }
  }, [user?.role]);

  // TEACHERS

  const loadTeachers = useCallback(async () => {
    if (user?.role !== "admin") return;

    const requestId = nextRequestId("teachers");
    setTeacherLoading(true);
    setTeacherError("");

    try {
      const data = await apiRequest("/api/teachers");

      if (requestIds.current.teachers === requestId) {
        setTeachers(data.teachers || []);
      }
    } catch (err) {
      if (requestIds.current.teachers === requestId) {
        setTeacherError(err.message || "Unable to load teachers.");
      }
    } finally {
      if (requestIds.current.teachers === requestId) {
        setTeacherLoading(false);
      }
    }
  }, [user?.role]);

  // CLASSES
  // Do not reset a user's selected class if it is still available.

  const loadClasses = useCallback(async () => {
    if (!["admin", "teacher"].includes(user?.role)) return;

    const requestId = nextRequestId("classes");
    setClassLoading(true);
    setClassError("");

    try {
      const data = await apiRequest("/api/classes");
      const loadedClasses = data.classes || [];

      if (requestIds.current.classes !== requestId) return;

      setClasses(loadedClasses);

      setAttendanceClassId((currentId) => {
        if (
          currentId &&
          loadedClasses.some((item) => recordId(item) === currentId)
        ) {
          return currentId;
        }

        if (user.role === "teacher") {
          return loadedClasses[0] ? recordId(loadedClasses[0]) : "";
        }

        return currentId;
      });
    } catch (err) {
      if (requestIds.current.classes === requestId) {
        setClassError(err.message || "Unable to load classes.");
      }
    } finally {
      if (requestIds.current.classes === requestId) {
        setClassLoading(false);
      }
    }
  }, [user?.role]);

  // STUDENT DIRECTORY

  const loadStudents = useCallback(async () => {
    if (user?.role !== "admin") return;

    const requestId = nextRequestId("students");
    setStudentLoading(true);
    setStudentError("");

    try {
      const params = new URLSearchParams();

      if (studentSearch.trim()) {
        params.set("search", studentSearch.trim());
      }
      if (studentClassFilter) {
        params.set("className", studentClassFilter);
      }
      if (studentSectionFilter) {
        params.set("section", studentSectionFilter);
      }

      const query = params.toString();
      const data = await apiRequest(
        `/api/students${query ? `?${query}` : ""}`
      );

      if (requestIds.current.students === requestId) {
        setStudents(data.students || []);
      }
    } catch (err) {
      if (requestIds.current.students === requestId) {
        setStudentError(err.message || "Unable to load students.");
      }
    } finally {
      if (requestIds.current.students === requestId) {
        setStudentLoading(false);
      }
    }
  }, [
    user?.role,
    studentSearch,
    studentClassFilter,
    studentSectionFilter,
  ]);

  // STUDENT SELF PROFILE

  const loadMyStudentProfile = useCallback(async () => {
    if (user?.role !== "student") return;

    const requestId = nextRequestId("myProfile");
    setStudentLoading(true);
    setStudentError("");

    try {
      const data = await apiRequest("/api/students/me");

      if (requestIds.current.myProfile === requestId) {
        setMyStudentProfile(data.student || data.profile || null);
      }
    } catch (err) {
      if (requestIds.current.myProfile === requestId) {
        setStudentError(err.message || "Unable to load your profile.");
      }
    } finally {
      if (requestIds.current.myProfile === requestId) {
        setStudentLoading(false);
      }
    }
  }, [user?.role]);

  // ATTENDANCE HISTORY

  const loadAttendanceHistory = useCallback(async () => {
    if (!user) return;

    const requestId = nextRequestId("attendanceHistory");
    setAttendanceHistoryLoading(true);
    setAttendanceError("");

    try {
      const params = new URLSearchParams();

      if (attendanceDate) params.set("date", attendanceDate);

      if (user.role === "admin" || user.role === "teacher") {
        const selectedClass = classes.find(
          (item) => recordId(item) === attendanceClassId
        );

        if (selectedClass) {
          params.set("className", selectedClass.className);
          params.set("section", selectedClass.section);
        }
      }

      const query = params.toString();
      const data = await apiRequest(
        `/api/attendance${query ? `?${query}` : ""}`
      );

      if (requestIds.current.attendanceHistory === requestId) {
        setAttendanceRecords(getRecords(data));
      }
    } catch (err) {
      if (requestIds.current.attendanceHistory === requestId) {
        setAttendanceError(
          err.message || "Unable to load attendance history."
        );
      }
    } finally {
      if (requestIds.current.attendanceHistory === requestId) {
        setAttendanceHistoryLoading(false);
      }
    }
  }, [user?.role, attendanceDate, attendanceClassId, classes]);

  // CLASS STUDENTS AND THEIR EXISTING ATTENDANCE

  const loadAttendanceStudents = useCallback(async () => {
    if (!["admin", "teacher"].includes(user?.role)) return;

    const requestId = nextRequestId("attendanceStudents");
    setAttendanceStudentsLoading(true);
    setAttendanceError("");
    setAttendanceMessage("");

    try {
      const selectedClass = classes.find(
        (item) => recordId(item) === attendanceClassId
      );

      if (!selectedClass) {
        if (requestIds.current.attendanceStudents === requestId) {
          setAttendanceStudents([]);
          setAttendanceMarks({});
          setAttendanceRecords([]);
        }
        return;
      }

      const params = classQuery(selectedClass);
      const historyParams = classQuery(selectedClass);
      historyParams.set("date", attendanceDate);

      const [studentData, historyData] = await Promise.all([
        apiRequest(`/api/students?${params.toString()}`),
        apiRequest(`/api/attendance?${historyParams.toString()}`),
      ]);

      if (requestIds.current.attendanceStudents !== requestId) return;

      const activeStudents = studentData.students || [];
      const records = getRecords(historyData);
      const marks = {};

      for (const record of records) {
        const id = getStudentId(record);
        if (id) marks[id] = record.status;
      }

      setAttendanceStudents(activeStudents);
      setAttendanceRecords(records);

      // Preserve unsaved selections when refreshing the same class/date.
      setAttendanceMarks((current) => ({
        ...marks,
        ...current,
      }));
    } catch (err) {
      if (requestIds.current.attendanceStudents === requestId) {
        setAttendanceError(
          err.message || "Unable to load class attendance."
        );
      }
    } finally {
      if (requestIds.current.attendanceStudents === requestId) {
        setAttendanceStudentsLoading(false);
      }
    }
  }, [user?.role, classes, attendanceClassId, attendanceDate]);

  // PAGE DATA LOADING
  // Attendance requests are handled in a separate effect below.
  // This effect never calls loadAttendanceHistory.

  useEffect(() => {
    if (!user) return;

    if (page === "Dashboard" && user.role === "admin") {
      loadDashboard();
    }

    if (page === "Teachers" && user.role === "admin") {
      loadTeachers();
      loadClasses();
    }

    if (page === "Classes" && user.role === "admin") {
      loadClasses();
      loadTeachers();
    }

    if (page === "Students" && user.role === "admin") {
      loadClasses();
      loadStudents();
    }

    if (page === "Attendance") {
      if (user.role === "admin" || user.role === "teacher") {
        loadClasses();
      } else if (user.role === "student") {
        loadMyStudentProfile();
      }
    }
  }, [
    user?.role,
    page,
    loadDashboard,
    loadTeachers,
    loadClasses,
    loadStudents,
    loadMyStudentProfile,
  ]);

  // ONE attendance-loading effect.
  // It does not call loadClasses, so class updates cannot cause an endless loop.

  useEffect(() => {
    if (!user || page !== "Attendance") return;

    if (user.role === "student") {
      loadAttendanceHistory();
      return;
    }

    if (attendanceMode === "mark") {
      loadAttendanceStudents();
    } else {
      loadAttendanceHistory();
    }
  }, [
    user?.role,
    page,
    attendanceMode,
    attendanceDate,
    attendanceClassId,
    classes,
    loadAttendanceHistory,
    loadAttendanceStudents,
  ]);

  // LOGIN / LOGOUT

  async function login(event) {
  event.preventDefault();
  setError("");

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    setError("Please enter your email and password.");
    return;
  }

  if (!["admin", "teacher", "student"].includes(role)) {
    setError("Please select a valid login role.");
    return;
  }

  setLoginLoading(true);

  try {
    const response = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        role,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Unable to sign in.");
    }

    if (!data.token || !data.user) {
      throw new Error("Login response is missing user or token.");
    }

    if (data.user.role !== role) {
      throw new Error(
        "Your account does not match the selected login role."
      );
    }

    localStorage.setItem("schoolToken", data.token);
    localStorage.setItem("schoolUser", JSON.stringify(data.user));

    setUser(data.user);
    setPage("Dashboard");
    setPassword("");
    setShowPassword(false);
    setError("");

    setAttendanceClassId("");
    setAttendanceRecords([]);
    setAttendanceStudents([]);
    setAttendanceMarks({});
  } catch (err) {
    setError(err.message || "Unable to sign in.");
  } finally {
    setLoginLoading(false);
  }
}
  function logout() {
    // Invalidate any in-flight responses from the previous session.
    for (const key of Object.keys(requestIds.current)) {
      requestIds.current[key] += 1;
    }

    localStorage.removeItem("schoolToken");
    localStorage.removeItem("schoolUser");

    setUser(null);
    setPage("Dashboard");
    setPassword("");
    setError("");
    setStats(initialStats);
    setTeachers([]);
    setClasses([]);
    setStudents([]);
    setMyStudentProfile(null);
    setAttendanceRecords([]);
    setAttendanceStudents([]);
    setAttendanceMarks({});
    setAttendanceClassId("");
  }

  function navigateTo(nextPage) {
    setPage(nextPage);
    setError("");
    setAttendanceError("");
    setAttendanceMessage("");
  }

  // TEACHER CRUD

  function openAddTeacher() {
    setTeacherForm(emptyTeacher);
    setEditingTeacherId(null);
    setTeacherError("");
    setTeacherMessage("");
    setShowTeacherForm(true);
  }

  function openEditTeacher(teacher) {
    setTeacherForm({
      name: teacher.name || "",
      email: teacher.email || "",
      password: "",
      phone: teacher.phone || "",
      subject: teacher.subject || "",
      assignedClass: assignedClassId(teacher),
    });

    setEditingTeacherId(recordId(teacher));
    setTeacherError("");
    setTeacherMessage("");
    setShowTeacherForm(true);
  }

  function updateTeacherField(event) {
    const { name, value } = event.target;
    setTeacherForm((current) => ({ ...current, [name]: value }));
  }

  async function saveTeacher(event) {
    event.preventDefault();
    setTeacherError("");
    setTeacherMessage("");

    if (!teacherForm.name.trim() || !teacherForm.email.trim()) {
      setTeacherError("Name and email are required.");
      return;
    }

    if (!editingTeacherId && teacherForm.password.length < 6) {
      setTeacherError("Password must contain at least 6 characters.");
      return;
    }

    const payload = {
      name: teacherForm.name.trim(),
      email: teacherForm.email.trim(),
      phone: teacherForm.phone.trim(),
      subject: teacherForm.subject.trim(),
      assignedClass: teacherForm.assignedClass || null,
    };

    if (teacherForm.password) payload.password = teacherForm.password;

    setTeacherSaving(true);

    try {
      const editing = Boolean(editingTeacherId);
      const data = await apiRequest(
        editing ? `/api/teachers/${editingTeacherId}` : "/api/teachers",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      setTeacherMessage(data.message || "Teacher saved successfully.");
      setShowTeacherForm(false);
      setEditingTeacherId(null);

      await Promise.all([loadTeachers(), loadClasses(), loadDashboard()]);
    } catch (err) {
      setTeacherError(err.message || "Unable to save teacher.");
    } finally {
      setTeacherSaving(false);
    }
  }

  async function deleteTeacher(teacher) {
    if (!window.confirm(`Delete teacher ${teacher.name}?`)) return;

    setTeacherSaving(true);
    setTeacherError("");
    setTeacherMessage("");

    try {
      const data = await apiRequest(`/api/teachers/${recordId(teacher)}`, {
        method: "DELETE",
      });

      setTeacherMessage(data.message || "Teacher deleted successfully.");
      await Promise.all([loadTeachers(), loadClasses(), loadDashboard()]);
    } catch (err) {
      setTeacherError(err.message || "Unable to delete teacher.");
    } finally {
      setTeacherSaving(false);
    }
  }

  // CLASS CRUD

  function openAddClass() {
    setClassForm(emptyClass);
    setEditingClassId(null);
    setClassError("");
    setClassMessage("");
    setShowClassForm(true);
  }

  function openEditClass(schoolClass) {
    setClassForm({
      className: schoolClass.className || "",
      section: schoolClass.section || "",
      classTeacher: assignedClassId({
        assignedClass: schoolClass.classTeacher,
      }),
    });

    setEditingClassId(recordId(schoolClass));
    setClassError("");
    setClassMessage("");
    setShowClassForm(true);
  }

  function updateClassField(event) {
    const { name, value } = event.target;
    setClassForm((current) => ({ ...current, [name]: value }));
  }

  async function saveClass(event) {
    event.preventDefault();
    setClassError("");
    setClassMessage("");

    if (!classForm.className.trim() || !classForm.section.trim()) {
      setClassError("Class name and section are required.");
      return;
    }

    setClassSaving(true);

    try {
      const editing = Boolean(editingClassId);
      const data = await apiRequest(
        editing ? `/api/classes/${editingClassId}` : "/api/classes",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({
            className: classForm.className.trim(),
            section: classForm.section.trim().toUpperCase(),
            classTeacher: classForm.classTeacher || null,
          }),
        }
      );

      setClassMessage(data.message || "Class saved successfully.");
      setShowClassForm(false);
      setEditingClassId(null);

      await Promise.all([loadClasses(), loadTeachers(), loadDashboard()]);
    } catch (err) {
      setClassError(err.message || "Unable to save class.");
    } finally {
      setClassSaving(false);
    }
  }

  async function deleteClass(schoolClass) {
    const name = `${schoolClass.className}-${schoolClass.section}`;

    if (
      !window.confirm(
        `Delete class ${name}? Check that no students or attendance depend on it first.`
      )
    ) {
      return;
    }

    setClassSaving(true);
    setClassError("");
    setClassMessage("");

    try {
      const data = await apiRequest(`/api/classes/${recordId(schoolClass)}`, {
        method: "DELETE",
      });

      setClassMessage(data.message || "Class deleted successfully.");
      await Promise.all([loadClasses(), loadTeachers(), loadDashboard()]);
    } catch (err) {
      setClassError(err.message || "Unable to delete class.");
    } finally {
      setClassSaving(false);
    }
  }

  // STUDENT CRUD

  function openAddStudent() {
    setStudentForm(emptyStudent);
    setEditingStudentId(null);
    setStudentError("");
    setStudentMessage("");
    setShowStudentForm(true);
  }

  function openEditStudent(student) {
    setStudentForm({
      name: student.name || "",
      rollNumber: String(student.rollNumber ?? ""),
      className: String(student.className || ""),
      section: student.section || "",
      email: student.email || "",
      guardianContact: student.guardianContact || "",
      loginPassword: "",
    });

    setEditingStudentId(recordId(student));
    setStudentError("");
    setStudentMessage("");
    setShowStudentForm(true);
  }

  function updateStudentField(event) {
    const { name, value } = event.target;

    setStudentForm((current) => {
      const updated = { ...current, [name]: value };

      if (name === "className") {
        const exists = classes.some(
          (item) =>
            item.className === value && item.section === updated.section
        );

        if (!exists) updated.section = "";
      }

      return updated;
    });
  }

  async function saveStudent(event) {
    event.preventDefault();
    setStudentError("");
    setStudentMessage("");

    if (
      !studentForm.name.trim() ||
      !studentForm.rollNumber.trim() ||
      !studentForm.className ||
      !studentForm.section
    ) {
      setStudentError("Name, roll number, class and section are required.");
      return;
    }

    if (
      !editingStudentId &&
      studentForm.loginPassword &&
      studentForm.loginPassword.length < 6
    ) {
      setStudentError(
        "Student login password must contain at least 6 characters."
      );
      return;
    }

    setStudentSaving(true);

    try {
      const editing = Boolean(editingStudentId);
      const payload = {
        name: studentForm.name.trim(),
        rollNumber: studentForm.rollNumber.trim(),
        className: studentForm.className,
        section: studentForm.section,
        email: studentForm.email.trim(),
        guardianContact: studentForm.guardianContact.trim(),
      };

      if (!editing && studentForm.loginPassword) {
        payload.loginPassword = studentForm.loginPassword;
      }

      const data = await apiRequest(
        editing ? `/api/students/${editingStudentId}` : "/api/students",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      setStudentMessage(data.message || "Student saved successfully.");
      setShowStudentForm(false);
      setEditingStudentId(null);

      await Promise.all([loadStudents(), loadDashboard()]);
    } catch (err) {
      setStudentError(err.message || "Unable to save student.");
    } finally {
      setStudentSaving(false);
    }
  }

  async function deleteStudent(student) {
    if (!window.confirm(`Delete student ${student.name}?`)) return;

    setStudentSaving(true);
    setStudentError("");
    setStudentMessage("");

    try {
      const data = await apiRequest(`/api/students/${recordId(student)}`, {
        method: "DELETE",
      });

      setStudentMessage(data.message || "Student deleted successfully.");
      await Promise.all([loadStudents(), loadDashboard()]);
    } catch (err) {
      setStudentError(err.message || "Unable to delete student.");
    } finally {
      setStudentSaving(false);
    }
  }

  // ATTENDANCE

  function updateAttendanceMark(studentId, status) {
    setAttendanceMarks((current) => ({
      ...current,
      [studentId]: status,
    }));
  }

  async function markAttendance(event) {
    event.preventDefault();
    setAttendanceError("");
    setAttendanceMessage("");

    if (attendanceSaveLock.current) return;

    if (isStudent) {
      setAttendanceError("Students cannot mark or update attendance.");
      return;
    }

    if (!attendanceClassId) {
      setAttendanceError("Please select a class first.");
      return;
    }

    if (!attendanceStudents.length) {
      setAttendanceError("There are no active students in this class.");
      return;
    }

    const missing = attendanceStudents.filter(
      (student) => !attendanceMarks[recordId(student)]
    );

    if (missing.length) {
      setAttendanceError(
        `Please select attendance for every student. ${missing.length} student(s) still need a status.`
      );
      return;
    }

    attendanceSaveLock.current = true;
    setAttendanceSaving(true);

    try {
      const existingByStudent = new Map();

      for (const record of attendanceRecords) {
        const id = getStudentId(record);
        if (id) existingByStudent.set(id, record);
      }

      for (const student of attendanceStudents) {
        const studentId = recordId(student);
        const status = attendanceMarks[studentId];
        const existing = existingByStudent.get(studentId);

        if (existing) {
          await apiRequest(`/api/attendance/${recordId(existing)}`, {
            method: "PUT",
            body: JSON.stringify({ status }),
          });
        } else {
          await apiRequest("/api/attendance", {
            method: "POST",
            body: JSON.stringify({
              studentId,
              date: attendanceDate,
              status,
            }),
          });
        }
      }

      setAttendanceMessage("Attendance saved successfully.");
      await loadAttendanceStudents();

      if (isAdmin) await loadDashboard();
    } catch (err) {
      setAttendanceError(
        err.message ||
          "Unable to save attendance. Check the attendance API routes."
      );
    } finally {
      attendanceSaveLock.current = false;
      setAttendanceSaving(false);
    }
  }

  function exportAttendanceCsv() {
    const rows = [
      ["Date", "Student", "Roll Number", "Class", "Section", "Status"],
      ...attendanceRecords.map((record) => [
        record.date ? String(record.date).slice(0, 10) : attendanceDate,
        record.student?.name || "",
        record.student?.rollNumber || "",
        record.className || "",
        record.section || "",
        record.status || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `attendance-${attendanceDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  // LOGIN SCREEN

  // LOGIN SCREEN

if (!user) {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-icon">S</div>

        <p className="eyebrow">SCHOOL MANAGEMENT</p>
        <h1>Welcome back</h1>
        <p className="muted">
          Sign in to your School ERP account.
        </p>

        <form onSubmit={login}>
          <label htmlFor="login-role">Login as</label>
          <select
            id="login-role"
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setError("");
            }}
            required
          >
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </select>

          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            placeholder="Enter your email"
            autoComplete="username"
            required
          />

          <label htmlFor="login-password">Password</label>

          <div className="password-field">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setShowPassword((current) => !current)
              }
              aria-label={
                showPassword ? "Hide password" : "Show password"
              }
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="primary-button login-button"
            disabled={loginLoading}
          >
            {loginLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="login-footer">
          Secure School ERP Portal
        </p>
      </section>
    </main>
  );
}

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon small">S</div>
          <div>
            <strong>School ERP</strong>
            <span>Management Portal</span>
          </div>
        </div>

        <p className="menu-label">MAIN MENU</p>

        <nav>
          {visibleMenuItems.map((item) => (
            <button
              key={item.name}
              type="button"
              className={`nav-item ${page === item.name ? "active" : ""}`}
              onClick={() => navigateTo(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-avatar">
            {user.name?.charAt(0)?.toUpperCase() || "U"}
          </div>

          <div className="user-details">
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={logout}
            title="Logout"
            aria-label="Logout"
          >
            ↪
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">SCHOOL MANAGEMENT</p>
            <h1>{page}</h1>
          </div>
          <div className="topbar-user">
            <span className="online-dot" />
            {user.name}
          </div>
        </header>

        {/* DASHBOARD */}

        {page === "Dashboard" && (
          <section className="dashboard-content">
            <div className="welcome-banner">
              <div>
                <p>YOUR SCHOOL AT A GLANCE</p>
                <h2>Welcome, {user.name}!</h2>
                <span>
                  {isAdmin
                    ? "Here is your school overview for today."
                    : isTeacher
                      ? "Manage attendance for your assigned class."
                      : "View your profile and attendance records."}
                </span>
              </div>
              <div className="banner-symbol">✦</div>
            </div>

            {error && <div className="error-message" role="alert">{error}</div>}

            {isAdmin && (
              <>
                <div className="panel-heading">
                  <div>
                    <h2 className="section-heading">Overview</h2>
                    <p className="muted">Current school statistics</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={loadDashboard}
                    disabled={dashboardLoading}
                  >
                    {dashboardLoading ? "Refreshing..." : "↻ Refresh"}
                  </button>
                </div>

                <div className="stats-grid">
                  <StatCard title="Total Students" value={stats.totalStudents} icon="♧" />
                  <StatCard title="Total Teachers" value={stats.totalTeachers} icon="♙" />
                  <StatCard title="Total Classes" value={stats.totalClasses} icon="▤" />
                  <StatCard title="Attendance Marked" value={stats.todayAttendance} icon="✓" />
                </div>

                <section className="attendance-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Today's Attendance</h2>
                      <p>Summary of attendance records</p>
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => navigateTo("Attendance")}
                    >
                      View attendance →
                    </button>
                  </div>

                  <div className="attendance-grid">
                    <AttendanceCard label="Present" value={stats.presentToday} type="present" />
                    <AttendanceCard label="Absent" value={stats.absentToday} type="absent" />
                    <AttendanceCard label="Late" value={stats.lateToday} type="late" />
                  </div>

                  <p className="muted">
                    Present today: {stats.presentToday} of {stats.totalStudents} students
                    {" · "}Attendance marked: {stats.todayAttendance} record(s).
                  </p>
                  {stats.classAttendance?.length > 0 && (
                    <div className="class-attendance-summary">
                      <h3>By class</h3>
                      {stats.classAttendance.map((item) => (
                        <p key={`${item.className}-${item.section}`}>
                          <strong>{item.className} - {item.section}:</strong>{" "}
                          {item.presentToday} of {item.totalStudents} present
                          {" · "}{item.absentToday} absent
                          {" · "}{item.lateToday} late
                        </p>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {isTeacher && (
              <section className="management-panel">
                <h2>Teacher workspace</h2>
                <p className="muted">
                  You can view your assigned class and mark or review its attendance.
                </p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => navigateTo("Attendance")}
                >
                  Open Attendance →
                </button>
              </section>
            )}

            {isStudent && (
              <section className="management-panel">
                <h2>My student profile</h2>

                {studentError && (
                  <p className="error-message" role="alert">{studentError}</p>
                )}

                {studentLoading ? (
                  <Empty text="Loading your profile..." />
                ) : myStudentProfile ? (
                  <div className="form-grid">
                    <Field label="Name">
                      <p>{myStudentProfile.name || user.name || "—"}</p>
                    </Field>
                    <Field label="Roll number">
                      <p>{myStudentProfile.rollNumber || "—"}</p>
                    </Field>
                    <Field label="Class">
                      <p>
                        {myStudentProfile.className || "—"}
                        {myStudentProfile.section
                          ? ` - ${myStudentProfile.section}`
                          : ""}
                      </p>
                    </Field>
                    <Field label="Email">
                      <p>{myStudentProfile.email || user.email || "—"}</p>
                    </Field>
                  </div>
                ) : (
                  <Empty text="Your student profile is not available." />
                )}

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => navigateTo("Attendance")}
                >
                  View My Attendance →
                </button>
              </section>
            )}
          </section>
        )}

        {/* TEACHERS */}

        {page === "Teachers" && (
          <section className="management-content">
            {!isAdmin ? (
              <AccessDenied />
            ) : (
              <>
                <Toolbar
                  title="Teacher Directory"
                  description="Manage teachers and class assignments."
                  buttonText="+ Add Teacher"
                  onClick={openAddTeacher}
                />

                <Messages success={teacherMessage} error={teacherError} />

                {showTeacherForm && (
                  <form className="management-panel" onSubmit={saveTeacher}>
                    <h2>{editingTeacherId ? "Edit Teacher" : "Add Teacher"}</h2>

                    <div className="form-grid">
                      <Field label="Full name *">
                        <input name="name" value={teacherForm.name} onChange={updateTeacherField} required />
                      </Field>
                      <Field label="Email *">
                        <input name="email" type="email" value={teacherForm.email} onChange={updateTeacherField} required />
                      </Field>
                      <Field label={editingTeacherId ? "New password (optional)" : "Password *"}>
                        <input name="password" type="password" value={teacherForm.password} onChange={updateTeacherField} minLength={6} required={!editingTeacherId} autoComplete="new-password" />
                      </Field>
                      <Field label="Phone">
                        <input name="phone" value={teacherForm.phone} onChange={updateTeacherField} />
                      </Field>
                      <Field label="Subject">
                        <input name="subject" value={teacherForm.subject} onChange={updateTeacherField} />
                      </Field>
                      <Field label="Assigned class">
                        <select name="assignedClass" value={teacherForm.assignedClass} onChange={updateTeacherField}>
                          <option value="">No class assigned</option>
                          {classes.map((item) => (
                            <option key={recordId(item)} value={recordId(item)}>
                              Class {item.className} - Section {item.section}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <FormActions saving={teacherSaving} onCancel={() => setShowTeacherForm(false)} submitText={editingTeacherId ? "Save Changes" : "Create Teacher"} />
                  </form>
                )}

                <section className="management-panel">
                  <PanelTitle title="All Teachers" count={teachers.length} loading={teacherLoading} onRefresh={loadTeachers} />

                  {teacherLoading ? (
                    <Empty text="Loading teachers..." />
                  ) : teachers.length === 0 ? (
                    <Empty text="No teachers found." />
                  ) : (
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr><th>Teacher</th><th>Phone</th><th>Subject</th><th>Class</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                          {teachers.map((teacher) => (
                            <tr key={recordId(teacher)}>
                              <td>
                                <strong>{teacher.name}</strong>
                                <span className="table-subtext">{teacher.email}</span>
                              </td>
                              <td>{teacher.phone || "—"}</td>
                              <td>{teacher.subject || "—"}</td>
                              <td>
                                {teacher.assignedClass?.className
                                  ? `Class ${teacher.assignedClass.className} - ${teacher.assignedClass.section}`
                                  : "Not assigned"}
                              </td>
                              <td>
                                <div className="table-actions">
                                  <button type="button" className="secondary-button action-button" onClick={() => openEditTeacher(teacher)}>Edit</button>
                                  <button type="button" className="danger-button action-button" disabled={teacherSaving} onClick={() => deleteTeacher(teacher)}>Delete</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        )}

        {/* CLASSES */}

        {page === "Classes" && (
          <section className="management-content">
            {!isAdmin ? (
              <AccessDenied />
            ) : (
              <>
                <Toolbar title="Class Directory" description="Create classes, manage sections and assign teachers." buttonText="+ Add Class" onClick={openAddClass} />
                <Messages success={classMessage} error={classError} />

                {showClassForm && (
                  <form className="management-panel" onSubmit={saveClass}>
                    <h2>{editingClassId ? "Edit Class" : "Create Class"}</h2>
                    <div className="form-grid">
                      <Field label="Class name *">
                        <input name="className" value={classForm.className} onChange={updateClassField} placeholder="e.g. 10" required />
                      </Field>
                      <Field label="Section *">
                        <input name="section" value={classForm.section} onChange={updateClassField} placeholder="e.g. A" required />
                      </Field>
                      <Field label="Class teacher">
                        <select name="classTeacher" value={classForm.classTeacher} onChange={updateClassField}>
                          <option value="">No teacher assigned</option>
                          {teachers.map((teacher) => (
                            <option key={recordId(teacher)} value={recordId(teacher)}>
                              {teacher.name} — {teacher.email}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <FormActions saving={classSaving} onCancel={() => setShowClassForm(false)} submitText={editingClassId ? "Save Changes" : "Create Class"} />
                  </form>
                )}

                <section className="management-panel">
                  <PanelTitle title="All Classes" count={classes.length} loading={classLoading} onRefresh={loadClasses} />

                  {classLoading ? (
                    <Empty text="Loading classes..." />
                  ) : classes.length === 0 ? (
                    <Empty text="No classes found. Create your first class." />
                  ) : (
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr><th>Class</th><th>Section</th><th>Class Teacher</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                          {classes.map((item) => (
                            <tr key={recordId(item)}>
                              <td><strong>{item.className}</strong></td>
                              <td>{item.section}</td>
                              <td>
                                {item.classTeacher?.name || "Not assigned"}
                                {item.classTeacher?.email && <span className="table-subtext">{item.classTeacher.email}</span>}
                              </td>
                              <td>
                                <div className="table-actions">
                                  <button type="button" className="secondary-button action-button" onClick={() => openEditClass(item)}>Edit</button>
                                  <button type="button" className="danger-button action-button" disabled={classSaving} onClick={() => deleteClass(item)}>Delete</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        )}

        {/* STUDENTS */}

        {page === "Students" && (
          <section className="management-content">
            {!isAdmin ? (
              <AccessDenied />
            ) : (
              <>
                <Toolbar title="Student Directory" description="Add, update, search and filter student records." buttonText="+ Add Student" onClick={openAddStudent} />
                <Messages success={studentMessage} error={studentError} />

                {showStudentForm && (
                  <form className="management-panel" onSubmit={saveStudent}>
                    <h2>{editingStudentId ? "Edit Student" : "Add Student"}</h2>
                    <div className="form-grid">
                      <Field label="Student name *">
                        <input name="name" value={studentForm.name} onChange={updateStudentField} required />
                      </Field>
                      <Field label="Roll number *">
                        <input name="rollNumber" value={studentForm.rollNumber} onChange={updateStudentField} required />
                      </Field>
                      <Field label="Class *">
                        <select name="className" value={studentForm.className} onChange={updateStudentField} required>
                          <option value="">Select class</option>
                          {[...new Set(classes.map((item) => item.className))].map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Section *">
                        <select name="section" value={studentForm.section} onChange={updateStudentField} required>
                          <option value="">Select section</option>
                          {classes.filter((item) => item.className === studentForm.className).map((item) => (
                            <option key={recordId(item)} value={item.section}>{item.section}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Email">
                        <input name="email" type="email" value={studentForm.email} onChange={updateStudentField} />
                      </Field>
                      <Field label="Guardian contact">
                        <input name="guardianContact" type="tel" value={studentForm.guardianContact} onChange={updateStudentField} />
                      </Field>

                      {!editingStudentId && (
                        <Field label="Student login password (optional)">
                          <input name="loginPassword" type="password" value={studentForm.loginPassword} onChange={updateStudentField} minLength={6} autoComplete="new-password" placeholder="At least 6 characters" />
                        </Field>
                      )}
                    </div>

                    {!editingStudentId && (
                      <p className="muted">
                        A student login account is created when you set a password.
                      </p>
                    )}

                    <FormActions saving={studentSaving} onCancel={() => setShowStudentForm(false)} submitText={editingStudentId ? "Save Changes" : "Create Student"} />
                  </form>
                )}

                <section className="management-panel">
                  <div className="form-grid filter-grid">
                    <Field label="Search students">
                      <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Name, roll number or email" />
                    </Field>
                    <Field label="Filter by class">
                      <select value={studentClassFilter} onChange={(event) => {
                        setStudentClassFilter(event.target.value);
                        setStudentSectionFilter("");
                      }}>
                        <option value="">All classes</option>
                        {[...new Set(classes.map((item) => item.className))].map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Filter by section">
                      <select value={studentSectionFilter} onChange={(event) => setStudentSectionFilter(event.target.value)}>
                        <option value="">All sections</option>
                        {[...new Set(classes.filter((item) => !studentClassFilter || item.className === studentClassFilter).map((item) => item.section))].map((section) => (
                          <option key={section} value={section}>{section}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="secondary-button" onClick={loadStudents} disabled={studentLoading}>
                      {studentLoading ? "Searching..." : "Search / Refresh"}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => {
                      setStudentSearch("");
                      setStudentClassFilter("");
                      setStudentSectionFilter("");
                    }}>
                      Clear filters
                    </button>
                  </div>

                  <PanelTitle title="All Students" count={students.length} loading={studentLoading} onRefresh={loadStudents} />

                  {studentLoading ? (
                    <Empty text="Loading students..." />
                  ) : students.length === 0 ? (
                    <Empty text="No students found for the selected filters." />
                  ) : (
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr><th>Student</th><th>Roll number</th><th>Class</th><th>Guardian contact</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                          {students.map((student) => (
                            <tr key={recordId(student)}>
                              <td>
                                <strong>{student.name}</strong>
                                <span className="table-subtext">{student.email || "No email"}</span>
                              </td>
                              <td>{student.rollNumber}</td>
                              <td>{student.className} - {student.section}</td>
                              <td>{student.guardianContact || "—"}</td>
                              <td>
                                <div className="table-actions">
                                  <button type="button" className="secondary-button action-button" onClick={() => openEditStudent(student)}>Edit</button>
                                  <button type="button" className="danger-button action-button" disabled={studentSaving} onClick={() => deleteStudent(student)}>Delete</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        )}

        {/* ATTENDANCE */}

        {page === "Attendance" && (
          <section className="management-content">
            <div className="management-toolbar">
              <div>
                <h2>{isStudent ? "My Attendance" : "Attendance Management"}</h2>
                <p>
                  {isStudent
                    ? "View your own attendance records."
                    : "Mark daily attendance and review saved records."}
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={exportAttendanceCsv} disabled={!attendanceRecords.length}>
                Export CSV
              </button>
            </div>

            <Messages success={attendanceMessage} error={attendanceError} />

            {isStudent ? (
              <section className="management-panel">
                <div className="form-grid">
                  <Field label={attendanceMode === "mark" ? "Attendance date (today)" : "Attendance date"}>
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={(event) => setAttendanceDate(event.target.value)}
                      disabled={attendanceMode === "mark"}
                      required
                    />
                  </Field>
                </div>

                <div className="form-actions">
                  <button type="button" className="secondary-button" onClick={loadAttendanceHistory} disabled={attendanceHistoryLoading}>
                    {attendanceHistoryLoading ? "Loading..." : "↻ Refresh"}
                  </button>
                </div>

                <PanelTitle title={`My Attendance — ${attendanceDate}`} count={attendanceRecords.length} loading={attendanceHistoryLoading} />

                {attendanceHistoryLoading ? (
                  <Empty text="Loading your attendance..." />
                ) : attendanceRecords.length === 0 ? (
                  <Empty text="No attendance records found for this date." />
                ) : (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr><th>Date</th><th>Class</th><th>Section</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {attendanceRecords.map((record) => (
                          <tr key={recordId(record)}>
                            <td>{record.date ? String(record.date).slice(0, 10) : attendanceDate}</td>
                            <td>{record.className || myStudentProfile?.className || "—"}</td>
                            <td>{record.section || myStudentProfile?.section || "—"}</td>
                            <td><span className={`status-pill ${record.status}`}>{record.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : (
              <>
                <section className="management-panel">
                  <div className="form-grid">
                    <Field label="Attendance date">
                      <input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} required />
                    </Field>

                    <Field label="Class and section">
                      <select value={attendanceClassId} onChange={(event) => setAttendanceClassId(event.target.value)}>
                        <option value="">Select class</option>
                        {classes.map((item) => (
                          <option key={recordId(item)} value={recordId(item)}>
                            Class {item.className} - Section {item.section}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="form-actions">
                    <button type="button" className={attendanceMode === "mark" ? "primary-button" : "secondary-button"} onClick={() => {
                      setAttendanceDate(todayString());
                      setAttendanceMode("mark");
                    }}>
                      Mark attendance
                    </button>
                    <button type="button" className={attendanceMode === "history" ? "primary-button" : "secondary-button"} onClick={() => setAttendanceMode("history")}>
                      View history
                    </button>
                    <button type="button" className="secondary-button" onClick={attendanceMode === "mark" ? loadAttendanceStudents : loadAttendanceHistory} disabled={attendanceLoading}>
                      {attendanceLoading ? "Loading..." : "↻ Refresh"}
                    </button>
                  </div>
                </section>

                {attendanceMode === "mark" && (
                  <form className="management-panel" onSubmit={markAttendance}>
                    <PanelTitle title="Student Attendance" count={attendanceStudents.length} loading={attendanceStudentsLoading} />

                    {!attendanceClassId ? (
                      <Empty text="Select a class and section to load its students." />
                    ) : attendanceStudentsLoading ? (
                      <Empty text="Loading students and existing attendance..." />
                    ) : attendanceStudents.length === 0 ? (
                      <Empty text="No active students found in this class." />
                    ) : (
                      <>
                        <div className="table-wrapper">
                          <table className="data-table">
                            <thead>
                              <tr><th>Student</th><th>Roll number</th><th>Attendance status</th></tr>
                            </thead>
                            <tbody>
                              {attendanceStudents.map((student) => (
                                <tr key={recordId(student)}>
                                  <td>{student.name}</td>
                                  <td>{student.rollNumber}</td>
                                  <td>
                                    <select value={attendanceMarks[recordId(student)] || ""} onChange={(event) => updateAttendanceMark(recordId(student), event.target.value)} required>
                                      <option value="">Select status</option>
                                      <option value="present">Present</option>
                                      <option value="absent">Absent</option>
                                      <option value="late">Late</option>
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="form-actions">
                          <button type="submit" className="primary-button" disabled={attendanceSaving}>
                            {attendanceSaving ? "Saving attendance..." : "Save Attendance"}
                          </button>
                        </div>
                      </>
                    )}
                  </form>
                )}

                {attendanceMode === "history" && (
                  <section className="management-panel">
                    <PanelTitle title={`Attendance History — ${attendanceDate}`} count={attendanceRecords.length} loading={attendanceHistoryLoading} onRefresh={loadAttendanceHistory} />

                    {attendanceHistoryLoading ? (
                      <Empty text="Loading attendance history..." />
                    ) : attendanceRecords.length === 0 ? (
                      <Empty text="No attendance records found for this date and class." />
                    ) : (
                      <div className="table-wrapper">
                        <table className="data-table">
                          <thead>
                            <tr><th>Student</th><th>Roll number</th><th>Class</th><th>Date</th><th>Status</th></tr>
                          </thead>
                          <tbody>
                            {attendanceRecords.map((record) => (
                              <tr key={recordId(record)}>
                                <td>{record.student?.name || "Unknown student"}</td>
                                <td>{record.student?.rollNumber || "—"}</td>
                                <td>{record.className} - {record.section}</td>
                                <td>{record.date ? String(record.date).slice(0, 10) : attendanceDate}</td>
                                <td><span className={`status-pill ${record.status}`}>{record.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value ?? 0}</strong>
      <span className="stat-caption">Current records</span>
    </article>
  );
}

function AttendanceCard({ label, value, type }) {
  return (
    <div className={`attendance-card ${type}`}>
      <span className="attendance-dot" />
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </div>
  );
}

function Toolbar({ title, description, buttonText, onClick }) {
  return (
    <div className="management-toolbar">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button type="button" className="primary-button" onClick={onClick}>
        {buttonText}
      </button>
    </div>
  );
}

function Messages({ success, error }) {
  return (
    <>
      {success && <div className="success-message" role="status">{success}</div>}
      {error && <div className="error-message" role="alert">{error}</div>}
    </>
  );
}

function Field({ label, children }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function FormActions({ saving, onCancel, submitText }) {
  return (
    <div className="form-actions">
      <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
      <button type="submit" className="primary-button" disabled={saving}>
        {saving ? "Saving..." : submitText}
      </button>
    </div>
  );
}

function PanelTitle({ title, count, loading, onRefresh }) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {count !== undefined && <p>{count} record(s)</p>}
      </div>
      {onRefresh && (
        <button type="button" className="secondary-button" onClick={onRefresh} disabled={loading}>
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      )}
    </div>
  );
}

function Empty({ text }) {
  return <div className="empty-state">{text}</div>;
}

function AccessDenied() {
  return (
    <div className="management-panel">
      <h2>Admin access required</h2>
      <p>Your account cannot manage these records.</p>
    </div>
  );
}
