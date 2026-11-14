import { Link } from "react-router-dom";
import {
    MapPin,
    MessageSquare,
    MessageCircle,
    CalendarDays,
    Users,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

const sections = [
    {
        title: "Resorts",
        description: "Manage resort listings, locations, and contact information.",
        path: "/admin/destinations",
        icon: MapPin,
    },
    {
        title: "Bookings",
        description: "Manage group bookings, daily capacity, and availability.",
        path: "/admin/bookings",
        icon: CalendarDays,
    },
    {
        title: "Messages",
        description: "View and respond to client inquiries and resort staff conversations.",
        path: "/admin/messages",
        icon: MessageCircle,
    },
    {
        title: "Staff Management",
        description: "Manage resort staff accounts and resort assignments.",
        path: "/admin/staff",
        icon: Users,
        adminOnly: true,
    },
    {
        title: "Feedback",
        description: "Review and manage visitor feedback.",
        path: "/admin/feedback",
        icon: MessageSquare,
        adminOnly: true,
    },
];

export default function AdminHome() {
    const { isAdmin } = useAuth();

    const visibleSections = sections.filter(
        (section) => !section.adminOnly || isAdmin
    );

    return (
        <div className="admin-content">
            <header className="admin-page-header">
                <div>
                    <p className="admin-eyebrow">RESORT MANAGEMENT</p>
                    <h1>Dashboard</h1>
                    <p>Manage resort listings and visitor content.</p>
                </div>
            </header>

            <section className="admin-section-grid">
                {visibleSections.map(({ title, description, path, icon: Icon }) => (
                    <Link
                        to={path}
                        className="admin-section-card"
                        key={title}
                    >
                        <div className="admin-card-icon">
                            <Icon size={22} />
                        </div>

                        <h2>{title}</h2>
                        <p>{description}</p>
                        <span>Manage section →</span>
                    </Link>
                ))}
            </section>
        </div>
    );
}