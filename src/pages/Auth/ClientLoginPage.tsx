import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

import "./ClientLoginPage.css";

export default function ClientLoginPage() {
    const { user, isClient, loading, signIn } = useAuth();
    const location = useLocation();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const from = location.state?.from?.pathname || "/";

    if (loading) {
        return <div>Checking session...</div>;
    }

    if (user && isClient) {
        return <Navigate to={from} replace />;
    }

    if (user) {
        return <Navigate to="/" replace />;
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            const message = await signIn(email, password);

            if (message) {
                setError(message);
            }
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="client-login">
            <div className="client-login__card">
                <header className="client-login__header">
                    <h1>Welcome Back</h1>
                    <p>Sign in to your client account.</p>
                </header>

                <form className="client-login__form" onSubmit={handleSubmit}>
                    <label htmlFor="client-email">Email Address</label>
                    <input
                        id="client-email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        required
                    />

                    <label htmlFor="client-password">Password</label>
                    <input
                        id="client-password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        required
                    />

                    {error && (
                        <p className="client-login__error" role="alert">
                            {error}
                        </p>
                    )}

                    <button type="submit" disabled={submitting}>
                        {submitting ? "Signing in..." : "Sign In"}
                    </button>
                </form>

                <p className="client-login__signup">
                    Don't have an account?{" "}
                    <Link to="/user/signup">Create one</Link>
                </p>

                <Link className="client-login__back" to="/login">
                    ← Back to login options
                </Link>
            </div>
        </main>
    );
}