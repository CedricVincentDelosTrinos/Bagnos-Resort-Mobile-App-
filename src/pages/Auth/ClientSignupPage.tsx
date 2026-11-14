import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

import "./ClientSignupPage.css";

export default function ClientSignupPage() {
    const { user, isClient, loading, signUp } = useAuth();

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [submitting, setSubmitting] = useState(false);

    if (loading) {
        return <div>Checking session...</div>;
    }

    if (user && isClient) {
        return <Navigate to="/" replace />;
    }

    if (user) {
        return <Navigate to="/" replace />;
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setSubmitting(true);

        try {
            const message = await signUp(email, password, fullName);

            if (message) {
                setError(message);
            } else {
                setSuccess(
                    "Registration successful. Please check your email if confirmation is required."
                );
            }
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="client-signup">
            <div className="client-signup__card">
                <header className="client-signup__header">
                    <h1>Create an Account</h1>
                    <p>Register to connect with the resort.</p>
                </header>

                <form className="client-signup__form" onSubmit={handleSubmit}>
                    <label htmlFor="signup-name">Full Name</label>
                    <input
                        id="signup-name"
                        type="text"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        autoComplete="name"
                        maxLength={100}
                        required
                    />

                    <label htmlFor="signup-email">Email Address</label>
                    <input
                        id="signup-email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        required
                    />

                    <label htmlFor="signup-password">Password</label>
                    <input
                        id="signup-password"
                        type="password"
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="new-password"
                        minLength={6}
                        required
                    />

                    <label htmlFor="signup-confirm-password">
                        Confirm Password
                    </label>
                    <input
                        id="signup-confirm-password"
                        type="password"
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(event) =>
                            setConfirmPassword(event.target.value)
                        }
                        autoComplete="new-password"
                        required
                    />

                    {error && (
                        <p className="client-signup__error" role="alert">
                            {error}
                        </p>
                    )}

                    {success && (
                        <p className="client-signup__success" role="status">
                            {success}
                        </p>
                    )}

                    <button type="submit" disabled={submitting}>
                        {submitting ? "Creating account..." : "Create Account"}
                    </button>
                </form>

                <p className="client-signup__login">
                    Already have an account?{" "}
                    <Link to="/user/login">Sign in</Link>
                </p>

                <Link className="client-signup__back" to="/login">
                    ← Back to login options
                </Link>
            </div>
        </main>
    );
}