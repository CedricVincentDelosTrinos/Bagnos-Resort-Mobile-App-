import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
    Copy,
    RefreshCw,
    UserPlus,
    Trash2,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import "./StaffManagementPage.css";
import StaffApplicationManagement from "../Staff/StaffApplicationManagement";

interface Destination {
    id: string;
    name: string;
}

interface StaffRecord {
    id: string;
    user_id: string;
    email: string | null;
    destination_id: string;
    status: "active" | "suspended";
    created_at: string;
    destinations: { name: string } | null;
}

interface InvitationResponse {
    success?: boolean;
    invitation?: {
        id: string;
        email: string;
        expires_at: string;
    };
    invitation_token?: string;
    message?: string;
    error?: string;
}

interface DeleteStaffResponse {
    success?: boolean;
    message?: string;
    error?: string;
}

export default function StaffManagementPage() {
    const [staff, setStaff] = useState<StaffRecord[]>([]);
    const [destinations, setDestinations] = useState<Destination[]>([]);

    const [email, setEmail] = useState("");
    const [invitationLink, setInvitationLink] = useState("");
    const [invitationEmail, setInvitationEmail] = useState("");
    const [invitationExpiresAt, setInvitationExpiresAt] = useState("");

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [actionId, setActionId] = useState<string | null>(null);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [staffDestinationFilter, setStaffDestinationFilter] = useState("all");

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");

        const [staffResult, destinationResult] = await Promise.all([
            supabase
                .from("resort_staff")
                .select(`
                    id,
                    user_id,
                    email,
                    destination_id,
                    status,
                    created_at,
                    destinations(name)
                `)
                .order("created_at", { ascending: false }),

            supabase
                .from("destinations")
                .select("id, name")
                .order("name"),
        ]);

        if (staffResult.error) {
            setError(staffResult.error.message);
        } else {
            setStaff((staffResult.data ?? []) as unknown as StaffRecord[]);
        }

        if (destinationResult.error) {
            setError(destinationResult.error.message);
        } else {
            setDestinations(destinationResult.data ?? []);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    async function handleCreateInvitation(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");
        setSuccess("");
        setInvitationLink("");
        setInvitationEmail("");
        setInvitationExpiresAt("");

        if (!email.trim()) {
            setError("Enter an email address.");
            return;
        }

        setSubmitting(true);

        try {
            const { data, error: functionError } =
                await supabase.functions.invoke<InvitationResponse>(
                    "create-staff-invitation",
                    {
                        body: {
                            email: email.trim(),
                        },
                    }
                );

            if (functionError) {
                let serverMessage = data?.error;

                if (!serverMessage && functionError.context instanceof Response) {
                    try {
                        const responseBody =
                            await functionError.context.clone().json();
                        serverMessage = responseBody?.error;
                    } catch {
                        // Fall back to the Supabase error message.
                    }
                }

                setError(serverMessage ?? functionError.message);
                return;
            }

            if (
                !data?.success ||
                !data.invitation ||
                !data.invitation_token
            ) {
                setError(data?.error ?? "Could not create the invitation.");
                return;
            }

            const link =
                `${window.location.origin}/staff/invite/` +
                data.invitation_token;

            setInvitationLink(link);
            setInvitationEmail(data.invitation.email);
            setInvitationExpiresAt(data.invitation.expires_at);

            setEmail("");
            setSuccess("Invitation created successfully.");
        } catch {
            setError("An unexpected error occurred while creating the invitation.");
        } finally {
            setSubmitting(false);
        }
    }

    async function copyInvitationLink() {
        if (!invitationLink) return;

        try {
            await navigator.clipboard.writeText(invitationLink);
            setSuccess("Invitation link copied. You can now share it with the applicant.");
        } catch {
            setError("Could not copy the link. Please copy it manually.");
        }
    }

    async function handleStatusChange(
        staffId: string,
        currentStatus: StaffRecord["status"]
    ) {
        const nextStatus =
            currentStatus === "active" ? "suspended" : "active";

        setActionId(staffId);
        setError("");
        setSuccess("");

        try {
            const { error: updateError } = await supabase
                .from("resort_staff")
                .update({ status: nextStatus })
                .eq("id", staffId);

            if (updateError) {
                setError(updateError.message);
                return;
            }

            setSuccess(
                nextStatus === "active"
                    ? "Staff assignment reactivated."
                    : "Staff assignment suspended."
            );

            await loadData();
        } finally {
            setActionId(null);
        }
    }

    async function handleDeleteAccount(member: StaffRecord) {
        const confirmed = window.confirm(
            `PERMANENTLY DELETE this Resort Staff account?\n\n` +
            `Email: ${member.email ?? "Email unavailable"}\n` +
            `Assigned resort: ${member.destinations?.name ?? "Unknown resort"}\n\n` +
            `This will permanently delete the staff assignment and the associated Supabase Auth account.\n\n` +
            `The resort and its bookings will NOT be deleted.\n\n` +
            `The staff member will no longer be able to log in. This action cannot be undone.`
        );

        if (!confirmed) return;

        setActionId(member.id);
        setError("");
        setSuccess("");

        try {
            const { data, error: functionError } =
                await supabase.functions.invoke<DeleteStaffResponse>(
                    "delete-resort-staff",
                    {
                        body: {
                            staff_id: member.id,
                        },
                    }
                );

            if (functionError) {
                let serverMessage = data?.error;

                if (!serverMessage && functionError.context instanceof Response) {
                    try {
                        const responseBody =
                            await functionError.context.clone().json();
                        serverMessage = responseBody?.error;
                    } catch {
                        // Fall back to the Supabase error message.
                    }
                }

                setError(
                    serverMessage ??
                    `Account deletion failed: ${functionError.message}`
                );
                return;
            }

            if (!data?.success) {
                setError(data?.error ?? "Could not permanently delete the account.");
                return;
            }

            setSuccess(
                data.message ?? "Staff account permanently deleted."
            );

            await loadData();
        } catch {
            setError("An unexpected error occurred while deleting the account.");
        } finally {
            setActionId(null);
        }
    }

    const filteredStaff = staff.filter((member) =>
        staffDestinationFilter === "all" ||
        member.destination_id === staffDestinationFilter
    );

    return (
        <div className="admin-content staff-management-page">
            <div className="admin-page-header">
                <div className="admin-header-row">
                    <div>
                        <h1>Staff Management</h1>
                        <p>
                            Manage Resort Staff invitations, applications,
                            and resort assignments.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="admin-secondary-button"
                        onClick={loadData}
                        disabled={loading}
                    >
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
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

            <section className="admin-form-panel">
                <h2>Generate Staff Invitation</h2>

                <p>
                    Generate a secure, one-time invitation link for the
                    applicant. You can share the link manually.
                </p>

                <form className="admin-form" onSubmit={handleCreateInvitation}>
                    <div className="admin-form-grid">
                        <label>
                            Staff Email
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="staff@example.com"
                                required
                            />
                        </label>
                    </div>

                    <div className="admin-form-actions">
                        <button
                            type="submit"
                            className="admin-primary-button"
                            disabled={submitting}
                        >
                            <UserPlus size={17} />
                            {submitting
                                ? "Generating Invitation..."
                                : "Generate Invitation Link"}
                        </button>
                    </div>
                </form>
            </section>

            {invitationLink && (
                <section className="admin-form-panel">
                    <h2>Invitation Ready</h2>

                    <p>
                        Invitation for: <strong>{invitationEmail}</strong>
                    </p>

                    <p>
                        Expires:{" "}
                        <strong>
                            {new Date(invitationExpiresAt).toLocaleString()}
                        </strong>
                    </p>

                    <div className="staff-password">
                        <code>{invitationLink}</code>

                        <button
                            type="button"
                            className="admin-secondary-button"
                            onClick={copyInvitationLink}
                        >
                            <Copy size={16} />
                            Copy Link
                        </button>
                    </div>

                    <p className="staff-password-warning">
                        Share this link directly with the intended applicant.
                        It expires after seven days and should be treated as
                        private. Generate another invitation if this one is
                        lost or compromised.
                    </p>
                </section>
            )}

            <StaffApplicationManagement />
            <section className="admin-list-section">
                <div className="staff-list-heading">
                    <div>
                        <h2>Assigned Staff</h2>
                        <p>
                            Showing {filteredStaff.length} of {staff.length}{" "}
                            staff assignment(s)
                        </p>
                    </div>

                    <select
                        value={staffDestinationFilter}
                        onChange={(event) =>
                            setStaffDestinationFilter(event.target.value)
                        }
                        aria-label="Filter staff by assigned resort"
                        className="staff-resort-filter"
                    >
                        <option value="all">All Resorts</option>

                        {destinations.map((destination) => (
                            <option key={destination.id} value={destination.id}>
                                {destination.name}
                            </option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <p>Loading staff...</p>
                ) : staff.length === 0 ? (
                    <div className="admin-empty-state">
                        <p>No Resort Staff assignments have been created yet.</p>
                    </div>
                ) : filteredStaff.length === 0 ? (
                    <div className="admin-empty-state">
                        <p>No staff assignments found for this resort.</p>
                    </div>
                ) : (
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Email</th>
                                    <th>Assigned Resort</th>
                                    <th>Status</th>
                                    <th>Date Added</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredStaff.map((member) => (
                                    <tr key={member.id}>
                                        <td>{member.email ?? "Email unavailable"}</td>

                                        <td>
                                            {member.destinations?.name ??
                                                "Unknown resort"}
                                        </td>

                                        <td>
                                            <span
                                                className={`staff-status staff-status--${member.status}`}
                                            >
                                                {member.status}
                                            </span>
                                        </td>

                                        <td>
                                            {new Date(
                                                member.created_at
                                            ).toLocaleDateString()}
                                        </td>

                                        <td>
                                            <div className="staff-actions">
                                                <button
                                                    type="button"
                                                    className="admin-secondary-button"
                                                    disabled={actionId !== null}
                                                    onClick={() =>
                                                        handleStatusChange(
                                                            member.id,
                                                            member.status
                                                        )
                                                    }
                                                >
                                                    {actionId === member.id ? (
                                                        <RefreshCw
                                                            size={16}
                                                            className="staff-action-loading"
                                                        />
                                                    ) : member.status === "active" ? (
                                                        "Suspend"
                                                    ) : (
                                                        "Reactivate"
                                                    )}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="admin-icon-button"
                                                    title="Permanently delete staff account"
                                                    aria-label={`Permanently delete ${member.email ?? "staff account"}`}
                                                    disabled={actionId !== null}
                                                    onClick={() =>
                                                        handleDeleteAccount(member)
                                                    }
                                                >
                                                    {actionId === member.id ? (
                                                        <RefreshCw
                                                            size={17}
                                                            className="staff-action-loading"
                                                        />
                                                    ) : (
                                                        <Trash2 size={17} />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}