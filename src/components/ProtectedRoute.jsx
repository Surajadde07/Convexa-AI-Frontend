import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated, clearSession } from "../services/api";

export function logoutAndRedirect() {
    clearSession();

    sessionStorage.clear();

    window.location.replace("/");
}

export default function ProtectedRoute({ children }) {
    const location = useLocation();

    if (!isAuthenticated()) {
        return (
            <Navigate
                to="/"
                replace
                state={{ from: location }}
            />
        );
    }

    return children;
}