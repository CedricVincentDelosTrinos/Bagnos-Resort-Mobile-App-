import { Link } from "react-router-dom";

import "./LoginSelectionPage.css";

export default function LoginSelectionPage() {
    return (
        <main className="login-selection">
            <div className="login-selection__card">
                <header>
                    <h1>Welcome to Miraflor</h1>
                    <p>Choose how you want to sign in.</p>
                </header>

                <div className="login-selection__options">
                    <Link
                        to="/admin/login"
                        className="login-selection__option"
                    >
                        <h2>Admin / Resort Staff</h2>
                        <p>Access resort management and staff tools.</p>
                    </Link>

                    <Link
                        to="/user/login"
                        className="login-selection__option"
                    >
                        <h2>User / Client</h2>
                        <p>Sign in or create an account to contact the resort.</p>
                    </Link>
                </div>

                <Link to="/" className="login-selection__back">
                    ← Back to home
                </Link>
            </div>
        </main>
    );
}