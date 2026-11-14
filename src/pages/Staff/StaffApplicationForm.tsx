import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";

import "./StaffApplicationForm.css";

interface StaffApplicationFormProps {
    invitationId: string;
}

interface Destination {
    id: string;
    name: string;
}

type ApplicationType = "existing_resort" | "new_resort";

export default function StaffApplicationForm({
    invitationId,
}: StaffApplicationFormProps) {
    const [applicationType, setApplicationType] =
        useState<ApplicationType>("existing_resort");

    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [destinationsLoading, setDestinationsLoading] = useState(true);

    const [selectedDestinationId, setSelectedDestinationId] = useState("");
    const [resortName, setResortName] = useState("");
    const [location, setLocation] = useState("");
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [description, setDescription] = useState("");
    const [mapsUrl, setMapsUrl] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [applicationMessage, setApplicationMessage] = useState("");

    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;

        async function loadDestinations() {
            const { data, error: queryError } = await supabase
                .from("destinations")
                .select("id, name")
                .order("name");

            if (!mounted) return;

            if (queryError) {
                setError("Could not load the resort list. Please refresh the page.");
            } else {
                setDestinations(data ?? []);
            }

            setDestinationsLoading(false);
        }

        loadDestinations();

        return () => {
            mounted = false;
        };
    }, []);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        if (
            applicationType === "existing_resort" &&
            !selectedDestinationId
        ) {
            setError("Select the resort you want to manage.");
            return;
        }

        if (applicationType === "new_resort") {
            if (!resortName.trim() || !location.trim()) {
                setError("Resort name and location are required.");
                return;
            }

            if (
                (latitude.trim() && !longitude.trim()) ||
                (!latitude.trim() && longitude.trim())
            ) {
                setError("Enter both latitude and longitude, or leave both blank.");
                return;
            }

            if (
                latitude.trim() &&
                (Number(latitude) < -90 || Number(latitude) > 90)
            ) {
                setError("Latitude must be between -90 and 90.");
                return;
            }

            if (
                longitude.trim() &&
                (Number(longitude) < -180 || Number(longitude) > 180)
            ) {
                setError("Longitude must be between -180 and 180.");
                return;
            }

            if (mapsUrl.trim()) {
                try {
                    new URL(mapsUrl.trim());
                } catch {
                    setError("Enter a valid map URL.");
                    return;
                }
            }
        }

        setSubmitting(true);

        try {
            const { data, error: functionError } =
                await supabase.functions.invoke(
                    "submit-staff-application",
                    {
                        body: {
                            invitation_id: invitationId,
                            application_type: applicationType,

                            requested_destination_id:
                                applicationType === "existing_resort"
                                    ? selectedDestinationId
                                    : null,

                            proposed_resort_name:
                                applicationType === "new_resort"
                                    ? resortName.trim()
                                    : null,

                            proposed_location:
                                applicationType === "new_resort"
                                    ? location.trim()
                                    : null,

                            proposed_address:
                                applicationType === "new_resort"
                                    ? address.trim() || null
                                    : null,

                            proposed_phone:
                                applicationType === "new_resort"
                                    ? phone.trim() || null
                                    : null,

                            proposed_description:
                                applicationType === "new_resort"
                                    ? description.trim() || null
                                    : null,

                            proposed_maps_url:
                                applicationType === "new_resort"
                                    ? mapsUrl.trim() || null
                                    : null,

                            proposed_latitude:
                                applicationType === "new_resort" && latitude.trim()
                                    ? Number(latitude)
                                    : null,

                            proposed_longitude:
                                applicationType === "new_resort" && longitude.trim()
                                    ? Number(longitude)
                                    : null,

                            application_message:
                                applicationMessage.trim() || null,
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

            if (!data?.application) {
                throw new Error(
                    data?.error ?? "Your application could not be submitted."
                );
            }

            setSubmitted(true);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "An unexpected error occurred."
            );
        } finally {
            setSubmitting(false);
        }
    }

    if (submitted) {
        return (
            <div className="staff-invitation-success">
                <h2>Application Submitted</h2>

                <p>
                    Your Resort Staff application has been submitted
                    successfully.
                </p>

                <p>
                    An Admin will review your application. You will receive
                    Resort Staff access only if your application is approved.
                </p>
            </div>
        );
    }

    return (
        <form
            className="staff-invitation-form staff-application-form"
            onSubmit={handleSubmit}
        >
            <h2>Resort Staff Application</h2>

            {error && (
                <div className="admin-alert error" role="alert">
                    {error}
                </div>
            )}

            <label>
                What would you like to manage?
                <select
                    value={applicationType}
                    onChange={(event) => {
                        setApplicationType(
                            event.target.value as ApplicationType
                        );
                        setError("");
                    }}
                    required
                >
                    <option value="existing_resort">An existing resort</option>
                    <option value="new_resort">A new resort</option>
                </select>
            </label>

            {applicationType === "existing_resort" ? (
                <label>
                    Select Resort
                    <select
                        value={selectedDestinationId}
                        onChange={(event) =>
                            setSelectedDestinationId(event.target.value)
                        }
                        required
                        disabled={destinationsLoading}
                    >
                        <option value="">
                            {destinationsLoading
                                ? "Loading resorts..."
                                : "Choose a resort"}
                        </option>

                        {destinations.map((destination) => (
                            <option key={destination.id} value={destination.id}>
                                {destination.name}
                            </option>
                        ))}
                    </select>

                    {!destinationsLoading && destinations.length === 0 && (
                        <span className="staff-invitation-field-note">
                            No existing resorts are available. You can propose
                            a new resort instead.
                        </span>
                    )}
                </label>
            ) : (
                <>
                    <label>
                        Resort Name
                        <input
                            type="text"
                            value={resortName}
                            onChange={(event) => setResortName(event.target.value)}
                            maxLength={150}
                            required
                        />
                    </label>

                    <label>
                        Location
                        <input
                            type="text"
                            value={location}
                            onChange={(event) => setLocation(event.target.value)}
                            maxLength={255}
                            placeholder="Barangay, city or municipality"
                            required
                        />
                    </label>

                    <label>
                        Complete Address
                        <input
                            type="text"
                            value={address}
                            onChange={(event) => setAddress(event.target.value)}
                            maxLength={500}
                            placeholder="Optional"
                        />
                    </label>

                    <label>
                        Contact Number
                        <input
                            type="tel"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            maxLength={50}
                            placeholder="Optional"
                        />
                    </label>

                    <label>
                        Resort Description
                        <textarea
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            maxLength={2000}
                            rows={3}
                            placeholder="Optional"
                        />
                    </label>

                    <label>
                        Google Maps or Map URL
                        <input
                            type="url"
                            value={mapsUrl}
                            onChange={(event) => setMapsUrl(event.target.value)}
                            placeholder="https://maps.google.com/..."
                        />
                    </label>

                    <div className="staff-invitation-coordinate-fields">
                        <label>
                            Latitude
                            <input
                                type="number"
                                step="any"
                                min="-90"
                                max="90"
                                value={latitude}
                                onChange={(event) => setLatitude(event.target.value)}
                                placeholder="Optional"
                            />
                        </label>

                        <label>
                            Longitude
                            <input
                                type="number"
                                step="any"
                                min="-180"
                                max="180"
                                value={longitude}
                                onChange={(event) => setLongitude(event.target.value)}
                                placeholder="Optional"
                            />
                        </label>
                    </div>
                </>
            )}

            <label>
                Message to Admin
                <textarea
                    value={applicationMessage}
                    onChange={(event) =>
                        setApplicationMessage(event.target.value)
                    }
                    maxLength={2000}
                    rows={4}
                    placeholder="Tell us briefly about your application (optional)."
                />
            </label>

            <button
                type="submit"
                className="admin-primary-button"
                disabled={submitting || destinationsLoading}
            >
                {submitting ? "Submitting Application..." : "Submit Application"}
            </button>
        </form>
    );
}