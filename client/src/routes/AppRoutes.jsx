import { Routes, Route, Link } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import TeacherRoute from "./TeacherRoute";
import DashboardLayout from "../components/layout/DashboardLayout";
import Home from "../pages/Home/Home";
import TeacherLogin from "../pages/Auth/TeacherLogin";
import StudentLogin from "../pages/Auth/StudentLogin";
import Dashboard from "../pages/Teacher/Dashboard";
import Students from "../pages/Teacher/Students";
import Assessments from "../pages/Teacher/Assessments";
import CreateAssessment from "../pages/Teacher/CreateAssessment";
import EditAssessment from "../pages/Teacher/EditAssessment";
import QuestionBank from "../pages/Teacher/QuestionBank";
import LiveMonitor from "../pages/Teacher/LiveMonitor";
import Submissions from "../pages/Teacher/Submissions";
import Results from "../pages/Teacher/Results";
import Settings from "../pages/Teacher/Settings";
import StudentDashboard from "../pages/Student/StudentDashboard";
import AssessmentLobby from "../pages/Student/AssessmentLobby";
import Assessment from "../pages/Student/Assessment";
import Result from "../pages/Student/Result";
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login/teacher" element={<TeacherLogin />} />
      <Route path="/login/student" element={<StudentLogin />} />
      <Route element={<TeacherRoute />}>
        <Route path="/teacher" element={<DashboardLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="assessments" element={<Assessments />} />
          <Route path="assessments/new" element={<CreateAssessment />} />
          <Route path="assessments/:id" element={<EditAssessment />} />
          <Route path="questions" element={<QuestionBank />} />
          <Route path="monitor" element={<LiveMonitor />} />
          <Route path="submissions" element={<Submissions />} />
          <Route path="results" element={<Results />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute role="STUDENT" />}>
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/lobby/:id" element={<AssessmentLobby />} />
        <Route path="/student/attempt/:id" element={<Assessment />} />
        <Route path="/student/result/:id" element={<Result />} />
      </Route>
      <Route
        path="*"
        element={
          <main className="student-page">
            <h1>Page not found</h1>
            <Link to="/">Return home</Link>
          </main>
        }
      />
    </Routes>
  );
}
