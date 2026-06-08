import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated } from "../services/api";

/**
 * Wraps any route that requires authentication.
 * Redirects to /login and preserves the intended destination.
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
