import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { chromeOnlyMessage, isGoogleChrome } from "../utils/browserPolicy";
export default function ProtectedRoute({ role }) {
  const { user } = useAuth();
  if (role === "STUDENT" && !isGoogleChrome()) {
    return <main className="student-page"><div className="notice error" role="alert"><strong>Unsupported browser</strong><p>{chromeOnlyMessage}</p><p>Incognito mode and installed extensions cannot be verified by this website.</p></div></main>;
  }
  return user?.role === role ? (
    <Outlet />
  ) : (
    <Navigate to={"/login/" + role.toLowerCase()} replace />
  );
}
