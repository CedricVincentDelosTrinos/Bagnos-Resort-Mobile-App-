
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

interface ProtectedRouteProps {
    allowedRoles?: ("admin" | "staff" | "client")[];
}

export default function ProtectedRoute({
    allowedRoles = ["admin"],
}: ProtectedRouteProps) {
    const {
        user,
        isAdmin,
        isResortStaff,
        isClient,
        loading,
    } = useAuth();

    const location = useLocation();

    if (loading) {
        return <div>Checking access...</div>;
    }

    if (!user) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: location }}
            />
        );
    }

    const hasAccess =
        (allowedRoles.includes("admin") && isAdmin) ||
        (allowedRoles.includes("staff") && isResortStaff) ||
        (allowedRoles.includes("client") && isClient);

    if (!hasAccess) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
