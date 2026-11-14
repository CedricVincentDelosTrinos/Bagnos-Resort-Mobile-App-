
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FormEvent,
} from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

import "./StaffInvitationPage.css";
import StaffApplicationForm from "./StaffApplicationForm";

interface ClaimInvitationResponse {
    success?: boolean;
    invitation?: {
        id: string;
        email: string;
        expires_at: string;
    };
    message?: string;
    error?: string;
}

type AuthMode = "register" | "signin";

export default function StaffInvitationPage() {
    const { token } = useParams<{ token: string }>();

    const [mode, setMode] = useState<AuthMode>("register");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [claiming, setClaiming] = useState(false);

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [claimedInvitation, setClaimedInvitation] =
        useState<ClaimInvitationResponse["invitation"] | null>(null);

    const claimInProgress = useRef(false);

    const claimInvitation = useCallback(async () => {
        if (!token || claimInProgress.current || claimedInvitation) return;

        claimInProgress.current = true;
        setClaiming(true);
        setError("");
        setMessage("");

        try {
            const { data, error: functionError } =
                await supabase.functions.invoke<ClaimInvitationResponse>(
                    "claim-staff-invitation",
                    {
                        body: { token },
                    }
                );

            if (functionError) {
                let serverMessage = data?.error;

                if (
                    !serverMessage &&
                    functionError.context instanceof Response
                ) {
                    try {
                        const responseBody =
                            await functionError.context.clone().json();

                        serverMessage = responseBody?.error;
                    } catch {
                        // Fall back to the Supabase error message.
                    }
                }

                throw new Error(serverMessage ?? functionError.message);
            }

            if (!data?.success || !data.invitation) {
                throw new Error(
                    data?.error ?? "Could not claim this invitation."
                );
            }

            setClaimedInvitation(data.invitation);
            setMessage(
                data.message ?? "Invitation claimed successfully."
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "An unexpected error occurred."
            );

            claimInProgress.current = false;
        } finally {
            setClaiming(false);
        }
    }, [token, claimedInvitation]);

    useEffect(() => {
        let mounted = true;

        async function checkExistingSession() {
            if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
                if (mounted) {
                    setError("This invitation link is invalid.");
                    setLoading(false);
                }
                return;
            }

            const { data: authData, error: authError } =
                await supabase.auth.getUser();

            if (!mounted) return;

            if (authError) {
                setError("Could not verify your current session.");
                setLoading(false);
                return;
            }

            if (authData.user) {
                setEmail(authData.user.email ?? "");

                setLoading(false);
                await claimInvitation();
                return;
            }

            setLoading(false);
        }

        checkExistingSession();

        return () => {
            mounted = false;
        };
    }, [token, claimInvitation]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");
        setMessage("");

        if (!email.trim() || !password) {
            setError("Enter your email address and password.");
            return;
        }

        if (mode === "register" && password.length < 6) {
            setError("Your password must contain at least 6 characters.");
            return;
        }

        if (mode === "register" && password !== confirmPassword) {
            setError("Your passwords do not match.");
            return;
        }

        setSubmitting(true);

        try {
            if (mode === "register") {



                const { data, error: signUpError } =
                    await supabase.auth.signUp({
                        email: email.trim(),
                        password,
                        options: {
                            emailRedirectTo: window.location.href,
                        },
                    });

                if (signUpError) throw signUpError;

                if (!data.session || !data.user) {
                    throw new Error(
                        "Account created, but no active session was returned. Please try signing in."
                    );
                }

                await claimInvitation();

                await claimInvitation();
            }
            else {
                const { error: signInError } =
                    await supabase.auth.signInWithPassword({
                        email: email.trim(),
                        password,
                    }
                );

                if (signInError) throw signInError;

                await claimInvitation();
            }

        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Authentication failed."
            );
        } finally {
            setSubmitting(false);
        }
    }

    function changeMode(nextMode: AuthMode) {
        setMode(nextMode);
        setError("");
        setMessage("");
        setPassword("");
        setConfirmPassword("");
    }

    if (loading) {
        return (
            <main className="staff-invitation-page">
                <section className="staff-invitation-card">
                    <p>Checking your invitation...</p>
                </section>
            </main>
        );
    }

    return (
        <main className="staff-invitation-page">
            <section className="staff-invitation-card">
                <div className="staff-invitation-header">
                    <h1>Resort Staff Invitation</h1>
                    <p>
                        You've been invited to apply for a Resort Staff
                        account.
                    </p>
                </div>

                {error && (
                    <div className="admin-alert error" role="alert">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="admin-alert success" role="status">
                        {message}
                    </div>
                )}

                {claimedInvitation ? (
                    <StaffApplicationForm
                        invitationId={claimedInvitation.id}
                    />
                ) : (
                    <>
                        <div className="staff-invitation-tabs">
                            <button
                                type="button"
                                className={mode === "register" ? "active" : ""}
                                onClick={() => changeMode("register")}
                            >
                                Create Account
                            </button>

                            <button
                                type="button"
                                className={mode === "signin" ? "active" : ""}
                                onClick={() => changeMode("signin")}
                            >
                                Existing Account
                            </button>
                        </div>

                        <form
                            className="staff-invitation-form"
                            onSubmit={handleSubmit}
                        >
                            <label>
                                Email Address
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                    placeholder="staff@example.com"
                                    autoComplete="email"
                                    required
                                />
                            </label>

                            <label>
                                Password
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    placeholder="Enter your password"
                                    autoComplete={
                                        mode === "register"
                                            ? "new-password"
                                            : "current-password"
                                    }
                                    required
                                />
                            </label>

                            {mode === "register" && (
                                <label>
                                    Confirm Password
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(event) =>
                                            setConfirmPassword(event.target.value)
                                        }
                                        placeholder="Confirm your password"
                                        autoComplete="new-password"
                                        required
                                    />
                                </label>
                            )}

                            <button
                                type="submit"
                                className="admin-primary-button"
                                disabled={submitting || claiming}
                            >
                                {submitting
                                    ? "Please wait..."
                                    : claiming
                                        ? "Claiming Invitation..."
                                        : mode === "register"
                                            ? "Create Account"
                                            : "Sign In and Claim Invitation"}
                            </button>
                        </form>

                        <p className="staff-invitation-note">
                            Use the email address that received this
                            invitation. Only the invited email address
                            can claim this invitation.
                        </p>
                    </>
                )}
            </section>
        </main>
    );
}
