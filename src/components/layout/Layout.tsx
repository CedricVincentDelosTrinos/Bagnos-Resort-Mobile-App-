import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
    House,
    Search,
    MessageSquare,
    MessagesSquare,
} from "lucide-react";

import "./Layout.css";

const navigation = [
    { label: "Home", path: "/", icon: House, end: true },
    { label: "Explore", path: "/explore", icon: Search },
    { label: "Feedback", path: "/feedback", icon: MessageSquare },
];

export default function Layout() {
    const {
        user,
        isAdmin,
        isResortStaff,
        isClient,
        signOut,
    } = useAuth();

    const navigate = useNavigate();

    async function handleLogout() {
        await signOut();
        navigate("/", { replace: true });
    }

    return (
        <div className="app-shell">
            <header className="app-header">
                <div className="app-header__brand">
                    <span className="app-header__logo">✦</span>
                    <span>Resort Directory</span>
                </div>

                {isAdmin ? (
                    <NavLink to="/admin" className="app-header__admin">
                        Admin
                    </NavLink>
                ) : isResortStaff ? (
                    <NavLink to="/admin" className="app-header__admin">
                        Staff
                    </NavLink>
                ) : user ? (
                    <button
                        type="button"
                        className="app-header__admin"
                        onClick={handleLogout}
                    >
                        Log Out
                    </button>
                ) : (
                    <NavLink to="/login" className="app-header__admin">
                        Log In
                    </NavLink>
                )}
            </header>

            <main className="app-main">
                <Outlet />
            </main>

            <nav className="bottom-navigation" aria-label="Main navigation">
                {navigation.map(({ label, path, icon: Icon, end }) => (
                    <NavLink
                        key={path}
                        to={path}
                        end={end}
                        className={({ isActive }) =>
                            `bottom-navigation__item ${isActive ? "active" : ""}`
                        }
                    >
                        <Icon size={25} strokeWidth={2} />
                        <span>{label}</span>
                    </NavLink>
                ))}

                {user && isClient && (
                    <NavLink
                        to="/messages"
                        className={({ isActive }) =>
                            `bottom-navigation__item ${isActive ? "active" : ""}`
                        }
                    >
                        <MessagesSquare size={21} strokeWidth={2} />
                        <span>Messages</span>
                    </NavLink>
                )}
            </nav>
        </div>
    );
}