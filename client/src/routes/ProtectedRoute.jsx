import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
export default function ProtectedRoute({ role }) {
  const { user } = useAuth();
  return user?.role === role ? (
    <Outlet />
  ) : (
    <Navigate to={"/login/" + role.toLowerCase()} replace />
  );
}
