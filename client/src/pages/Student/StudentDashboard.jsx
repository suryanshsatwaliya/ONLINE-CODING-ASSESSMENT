import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

// Keep old bookmarks working without an extra dashboard screen.
export default function StudentDashboard() {
  const { user } = useAuth();
  return <Navigate replace to={user?.assessmentId ? `/student/lobby/${user.assessmentId}` : "/login/student"} />;
}
