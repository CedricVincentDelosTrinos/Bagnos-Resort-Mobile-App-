
import { createBrowserRouter } from "react-router-dom";

import Layout from "../../components/layout/Layout";
import AdminLayout from "../../components/Admin/AdminLayout";

import HomePage from "../../pages/Home/HomePage";
import ErrorPage from "../../pages/ErrorPage/ErrorPage";
import FeedbackPage from "../../pages/Feedback/FeedbackPage";
import MapPage from "../../pages/Map/MapPage";
import ExplorePage from "../../pages/Explore/ExplorePage";
import StaffInvitationPage from "../../pages/Staff/StaffInvitationPage";

import LoginPage from "../../pages/Admin/LoginPage";
import AdminHome from "../../pages/Admin/AdminHome";
import DestinationsPage from "../../pages/Admin/DestinationsPage";
import FeedbackAdminPage from "../../pages/Admin/FeedbackPage";
import StaffManagementPage from "../../pages/Admin/StaffManagementPage";
import BookingsPage from "../../pages/Admin/BookingsPage";

import ProtectedRoute from "../../auth/ProtectedRoute";
import LoginSelectionPage from "../../pages/Auth/LoginSelectionPage";
import ClientLoginPage from "../../pages/Auth/ClientLoginPage";
import ClientSignupPage from "../../pages/Auth/ClientSignupPage";

import ClientMessagesPage from "../../pages/Messages/ClientMessagesPage";
import AdminMessagesPage from "../../pages/Admin/AdminMessagesPage";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <Layout />,
        errorElement: <ErrorPage />,
        children: [
            { index: true, element: <HomePage /> },
            { path: "explore", element: <ExplorePage /> },
            { path: "feedback", element: <FeedbackPage /> },
            { path: "map", element: <MapPage /> },
            {
                element: <ProtectedRoute allowedRoles={["client"]} />,
                children: [
                    {
                        path: "messages",
                        element: <ClientMessagesPage />,
                    },
                ],
            },
        ],
    },
    { path: "/login", element: <LoginSelectionPage /> },
    { path: "/user/login", element: <ClientLoginPage /> },
    { path: "/user/signup", element: <ClientSignupPage /> },
    { path: "/admin/login", element: <LoginPage /> },
    {
        path: "/staff/invite/:token",
        element: <StaffInvitationPage />,
    },
    {
        element: <ProtectedRoute allowedRoles={["admin", "staff"]} />,
        children: [
            {
                path: "/admin",
                element: <AdminLayout />,
                children: [
                    { index: true, element: <AdminHome /> },
                    {
                        path: "destinations",
                        element: <DestinationsPage />,
                    },
                    {
                        path: "bookings",
                        element: <BookingsPage />,
                    },
                    {
                        path: "messages",
                        element: <AdminMessagesPage />,
                    },
                    {
                        element: <ProtectedRoute allowedRoles={["admin"]} />,
                        children: [
                            {
                                path: "staff",
                                element: <StaffManagementPage />,
                            },
                            {
                                path: "feedback",
                                element: <FeedbackAdminPage />,
                            },
                        ],
                    },
                ],
            },
        ],
    },
]);
