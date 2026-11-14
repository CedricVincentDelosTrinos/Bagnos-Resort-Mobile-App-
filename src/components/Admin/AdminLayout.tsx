
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    MapPin,
    MessageSquare,
    MessageCircle,
    Users,
    CalendarDays,
    LogOut,
    ArrowLeft,
} from "lucide-react";

import { useRef } from "react";
import { useAuth } from "../../auth/AuthContext";
import "./Admin.css";
import "./AdminMobileLayout.css";

const navigation = [
    { label: "Home", path: "/admin", icon: LayoutDashboard, end: true },
    { label: "Resorts", path: "/admin/destinations", icon: MapPin },
    { label: "Bookings", path: "/admin/bookings", icon: CalendarDays },
    { label: "Messages", path: "/admin/messages", icon: MessageCircle },
    { label: "Staff", path: "/admin/staff", icon: Users, adminOnly: true },
    { label: "Feedback", path: "/admin/feedback", icon: MessageSquare, adminOnly: true },
];

export default function AdminLayout() {
    const { signOut, isAdmin, isResortStaff } = useAuth();
    const navigate = useNavigate();

    const navRef = useRef<HTMLElement | null>(null);

    const dragState = useRef({
        isDragging: false,
        startX: 0,
        scrollLeft: 0,
        moved: false,
        suppressClick: false,
    });

    const visibleNavigation = navigation.filter(
        (item) => !item.adminOnly || isAdmin
    );

    function handleNavTouchStart(e: React.TouchEvent<HTMLElement>) {
        const touch = e.touches[0];

        dragState.current = {
            isDragging: true,
            startX: touch.clientX,
            scrollLeft: navRef.current?.scrollLeft ?? 0,
            moved: false,
            suppressClick: false,
        };
    }

    function handleNavTouchMove(e: React.TouchEvent<HTMLElement>) {
        const nav = navRef.current;
        if (!nav || !dragState.current.isDragging) return;

        const distance = e.touches[0].clientX - dragState.current.startX;

        if (Math.abs(distance) > 5) {
            dragState.current.moved = true;
        }

        if (dragState.current.moved) {
            nav.scrollLeft = dragState.current.scrollLeft - distance;
        }
    }

    function handleNavTouchEnd() {
        if (!dragState.current.isDragging) return;

        dragState.current.isDragging = false;
        dragState.current.suppressClick = dragState.current.moved;
    }

    function handleNavPointerDown(e: React.PointerEvent<HTMLElement>) {
        if (e.pointerType !== "mouse" || e.button !== 0) return;

        const nav = navRef.current;
        if (!nav) return;

        dragState.current = {
            isDragging: true,
            startX: e.clientX,
            scrollLeft: nav.scrollLeft,
            moved: false,
            suppressClick: false,
        };
    }

    function handleNavPointerMove(e: React.PointerEvent<HTMLElement>) {
        const nav = navRef.current;
        if (!nav || !dragState.current.isDragging) return;

        const distance = e.clientX - dragState.current.startX;

        if (Math.abs(distance) > 5) {
            dragState.current.moved = true;
        }

        if (dragState.current.moved) {
            nav.scrollLeft = dragState.current.scrollLeft - distance;
        }
    }

    function handleNavPointerUp() {
        if (!dragState.current.isDragging) return;

        dragState.current.isDragging = false;
        dragState.current.suppressClick = dragState.current.moved;
    }

    function handleNavPointerLeave() {
        if (!dragState.current.isDragging) return;

        dragState.current.isDragging = false;
        dragState.current.moved = false;
        dragState.current.suppressClick = false;
    }

    async function handleSignOut() {
        await signOut();
        navigate("/login", { replace: true });
    }

    return (
        <div className="admin-mobile-layout">
            <header className="admin-mobile-header">
                <div className="admin-mobile-header__brand">
                    <span className="admin-mobile-header__icon">✦</span>
                    <div>
                        <h1>Resort Directory</h1>
                        <span>
                            {isAdmin
                                ? "Admin Workspace"
                                : isResortStaff
                                    ? "Resort Staff Workspace"
                                    : "Workspace"}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    className="admin-mobile-header__back"
                    onClick={() => navigate("/")}
                >
                    <ArrowLeft size={17} />
                    <span>Back to App</span>
                </button>

                <button
                    type="button"
                    className="admin-mobile-header__logout"
                    onClick={handleSignOut}
                    aria-label="Sign out"
                >
                    <LogOut size={20} />
                </button>
            </header>

            <main className="admin-mobile-main">
                <Outlet />
            </main>

            <nav
                ref={navRef}
                className={`admin-mobile-nav ${dragState.current.isDragging ? "is-dragging" : ""
                    }`}
                onPointerDown={handleNavPointerDown}
                onPointerMove={handleNavPointerMove}
                onPointerUp={handleNavPointerUp}
                onPointerCancel={handleNavPointerUp}
                onPointerLeave={handleNavPointerLeave}
                onTouchStart={handleNavTouchStart}
                onTouchMove={handleNavTouchMove}
                onTouchEnd={handleNavTouchEnd}
                onTouchCancel={handleNavTouchEnd}
            >
                {visibleNavigation.map(({ label, path, icon: Icon, end }) => (
                    <NavLink
                        key={path}
                        to={path}
                        end={end}
                        onClick={(e) => {
                            if (dragState.current.suppressClick) {
                                e.preventDefault();
                                e.stopPropagation();
                            }

                            dragState.current.suppressClick = false;
                            dragState.current.moved = false;
                        }}
                        className={({ isActive }) =>
                            `admin-mobile-nav__item ${isActive ? "active" : ""}`
                        }
                    >
                        <Icon size={30} />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}
