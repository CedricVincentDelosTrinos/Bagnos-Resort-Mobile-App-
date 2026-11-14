
import { useCallback, useEffect, useState } from "react";
import {
    RefreshCw,
    Check,
    X,
    Trash2,
    ChevronDown,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import "./StaffApplicationManagement.css";

interface StaffApplication {
    id: string;
    invitation_id: string;
    applicant_user_id: string | null;
    applicant_email: string;
    application_type: "existing_resort" | "new_resort";
    requested_destination_id: string | null;
    proposed_resort_name: string | null;
    proposed_location: string | null;
    proposed_address: string | null;
    proposed_phone: string | null;
    proposed_description: string | null;
    proposed_maps_url: string | null;
    proposed_latitude: number | null;
    proposed_longitude: number | null;
    application_message: string | null;
    status: "pending" | "approved" | "rejected";
    created_at: string;
    destinations: { name: string } | null;
}

interface ReviewResponse {
    success?: boolean;
    message?: string;
    error?: string;
}

type ReviewAction = "approve" | "reject" | "delete";

export default function StaffApplicationManagement() {
    const [applications, setApplications] = useState<StaffApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);

    const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadApplications = useCallback(async () => {
        setLoading(true);
        setError("");

        const { data, error: queryError } = await supabase
            .from("staff_applications")
            .select(`
                *,
                destinations(name)
            `)
            .order("created_at", { ascending: false });

        if (queryError) {
            setError(queryError.message);
        } else {
            setApplications((data ?? []) as StaffApplication[]);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        loadApplications();
    }, [loadApplications]);

    async function handleReview(
        application: StaffApplication,
        action: ReviewAction
    ) {
        const notes = reviewNotes[application.id]?.trim() ?? "";

        if (action === "approve") {
            const confirmed = window.confirm(
                `Approve this Resort Staff application?\n\n` +
                `Applicant: ${application.applicant_email}\n` +
                `Resort: ${
                    application.application_type === "existing_resort"
                        ? application.destinations?.name ?? "Unknown resort"
                        : application.proposed_resort_name ?? "New resort"
                }\n\n` +
                `This will create an active Resort Staff assignment.`
            );

            if (!confirmed) return;
        }

        if (action === "reject") {
            const confirmed = window.confirm(
                `Reject the application from ${application.applicant_email}?`
            );

            if (!confirmed) return;
        }

        if (action === "delete") {
            const confirmed = window.confirm(
                `PERMANENTLY DELETE this application?\n\n` +
                `Applicant: ${application.applicant_email}\n\n` +
                `This only deletes the application record. It will NOT delete ` +
                `the applicant's account, resort, invitation, or bookings.\n\n` +
                `This action cannot be undone.`
            );

            if (!confirmed) return;
        }

        setActionId(application.id);
        setError("");
        setSuccess("");

        try {
            const { data, error: functionError } =
                await supabase.functions.invoke<ReviewResponse>(
                    "review-staff-application",
                    {
                        body: {
                            application_id: application.id,
                            action,
                            review_notes: notes || null,
                        },
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

            if (!data || data.error) {
                throw new Error(
                    data?.error ?? "The application action could not be completed."
                );
            }

            setSuccess(
                data.message ??
                    (action === "approve"
                        ? "Application approved successfully."
                        : action === "reject"
                          ? "Application rejected."
                          : "Application permanently deleted.")
            );

            setReviewNotes((previous) => {
                const updated = { ...previous };
                delete updated[application.id];
                return updated;
            });

            await loadApplications();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "An unexpected error occurred."
            );
        } finally {
            setActionId(null);
        }
    }

    function getApplicationResortName(application: StaffApplication) {
        return application.application_type === "existing_resort"
            ? application.destinations?.name ?? "Unknown resort"
            : application.proposed_resort_name ?? "Unnamed resort";
    }

    const pendingCount = applications.filter(
        (application) => application.status === "pending"
    ).length;

    return (
        <section className="admin-list-section staff-application-management">
            <div className="staff-list-heading">
                <div>
                    <h2>Staff Applications</h2>
                    <p>
                        {pendingCount} pending application(s) out of{" "}
                        {applications.length} total
                    </p>
                </div>

                <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={loadApplications}
                    disabled={loading || actionId !== null}
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="admin-alert error" role="alert">
                    {error}
                </div>
            )}

            {success && (
                <div className="admin-alert success" role="status">
                    {success}
                </div>
            )}

            {loading ? (
                <p>Loading applications...</p>
            ) : applications.length === 0 ? (
                <div className="admin-empty-state">
                    <p>No staff applications have been submitted yet.</p>
                </div>
            ) : (
                <div className="staff-application-list">
                    {applications.map((application) => (
                        <article
                            className="staff-application-card"
                            key={application.id}
                        >
                            <div className="staff-application-card-header">
                                <div>
                                    <h3>{application.applicant_email}</h3>

                                    <p>
                                        {getApplicationResortName(application)}
                                    </p>

                                    <span className="staff-application-date">
                                        Submitted{" "}
                                        {new Date(
                                            application.created_at
                                        ).toLocaleString()}
                                    </span>
                                </div>

                                <span
                                    className={`staff-application-status staff-application-status--${application.status}`}
                                >
                                    {application.status}
                                </span>
                            </div>

                            <details className="staff-application-details">
                                <summary>
                                    View Application Details
                                    <ChevronDown size={17} />
                                </summary>

                                <div className="staff-application-information">
                                    <div>
                                        <span>Application Type</span>
                                        <strong>
                                            {application.application_type ===
                                            "existing_resort"
                                                ? "Existing Resort"
                                                : "New Resort Proposal"}
                                        </strong>
                                    </div>

                                    {application.application_type ===
                                    "new_resort" ? (
                                        <>
                                            <div>
                                                <span>Resort Name</span>
                                                <strong>
                                                    {application.proposed_resort_name ??
                                                        "Not provided"}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Location</span>
                                                <strong>
                                                    {application.proposed_location ??
                                                        "Not provided"}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Complete Address</span>
                                                <strong>
                                                    {application.proposed_address ??
                                                        "Not provided"}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Contact Number</span>
                                                <strong>
                                                    {application.proposed_phone ??
                                                        "Not provided"}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Description</span>
                                                <p>
                                                    {application.proposed_description ??
                                                        "Not provided"}
                                                </p>
                                            </div>

                                            <div>
                                                <span>Map URL</span>
                                                {application.proposed_maps_url ? (
                                                    <a
                                                        href={application.proposed_maps_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        Open Map
                                                    </a>
                                                ) : (
                                                    <strong>Not provided</strong>
                                                )}
                                            </div>

                                            <div>
                                                <span>Coordinates</span>
                                                <strong>
                                                    {application.proposed_latitude !== null &&
                                                    application.proposed_longitude !== null
                                                        ? `${application.proposed_latitude}, ${application.proposed_longitude}`
                                                        : "Not provided"}
                                                </strong>
                                            </div>
                                        </>
                                    ) : (
                                        <div>
                                            <span>Requested Resort</span>
                                            <strong>
                                                {application.destinations?.name ??
                                                    "Unknown resort"}
                                            </strong>
                                        </div>
                                    )}

                                    <div>
                                        <span>Message to Admin</span>
                                        <p>
                                            {application.application_message ??
                                                "No message provided."}
                                        </p>
                                    </div>

                                    <div>
                                        <span>Applicant User ID</span>
                                        <strong>
                                            {application.applicant_user_id ??
                                                "Unavailable"}
                                        </strong>
                                    </div>
                                </div>
                            </details>

                            {application.status === "pending" && (
                                <div className="staff-application-review">
                                    <label>
                                        Review Notes
                                        <textarea
                                            value={
                                                reviewNotes[application.id] ?? ""
                                            }
                                            onChange={(event) =>
                                                setReviewNotes((previous) => ({
                                                    ...previous,
                                                    [application.id]:
                                                        event.target.value,
                                                }))
                                            }
                                            rows={3}
                                            maxLength={2000}
                                            placeholder="Optional notes about your decision..."
                                            disabled={actionId !== null}
                                        />
                                    </label>

                                    <div className="staff-application-actions">
                                        <button
                                            type="button"
                                            className="admin-primary-button"
                                            disabled={actionId !== null}
                                            onClick={() =>
                                                handleReview(
                                                    application,
                                                    "approve"
                                                )
                                            }
                                        >
                                            {actionId === application.id ? (
                                                <RefreshCw
                                                    size={16}
                                                    className="staff-action-loading"
                                                />
                                            ) : (
                                                <Check size={16} />
                                            )}
                                            Approve
                                        </button>

                                        <button
                                            type="button"
                                            className="staff-application-reject-button"
                                            disabled={actionId !== null}
                                            onClick={() =>
                                                handleReview(
                                                    application,
                                                    "reject"
                                                )
                                            }
                                        >
                                            <X size={16} />
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="staff-application-footer">
                                <button
                                    type="button"
                                    className="admin-icon-button"
                                    title="Permanently delete application"
                                    aria-label={`Permanently delete application from ${application.applicant_email}`}
                                    disabled={actionId !== null}
                                    onClick={() =>
                                        handleReview(application, "delete")
                                    }
                                >
                                    <Trash2 size={20} />
                                    
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
