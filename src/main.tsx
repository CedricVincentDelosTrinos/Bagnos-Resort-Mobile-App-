    import React from "react";
    import ReactDOM from "react-dom/client";
    import { RouterProvider } from "react-router-dom";

    import "./styles/globals.css";
    import { router } from "./app/router/router";
    import { AuthProvider } from "./auth/AuthContext";


    document.documentElement.setAttribute("data-theme", "light");

    ReactDOM.createRoot(document.getElementById("root")!).render(
        <React.StrictMode>
            <AuthProvider>
                <RouterProvider router={router} />
            </AuthProvider>
        </React.StrictMode>
    );