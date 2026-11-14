import { useAuth } from "../../auth/AuthContext";
import { useEffect, useState, type FormEvent } from "react";
import { MapPin, Plus, Pencil, Trash2, X } from "lucide-react";

import { supabase } from "../../lib/supabase";
import LocationPicker from "../../components/Admin/LocationPicker";
import { DESTINATION_TAGS } from "../../config/destinationTags";

import "./DestinationsPage.css";
import DescriptionEditor from "../../components/Admin/DescriptionEditor";

interface Destination {
    id: string;
    slug: string;
    name: string;
    parking_available: boolean;
    description: string | null;
    location: string | null;
    maps_url: string | null;
    image_url: string | null;
    latitude: number | null;
    longitude: number | null;
    tags: string[];
}

interface DestinationForm {
    slug: string;
    name: string;
    parking_available: boolean;
    description: string;
    location: string;
    maps_url: string;
    image_url: string;
    latitude: string;
    longitude: string;
    tags: string[];
}

const emptyForm: DestinationForm = {
    slug: "",
    name: "",
    parking_available: true,
    description: "",
    location: "",
    maps_url: "",
    image_url: "",
    latitude: "",
    longitude: "",
    tags: [],
};

function createSlug(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

const DESTINATION_DRAFT_KEY = "miraflor-admin-destination-draft";

interface DestinationDraft {
    form: DestinationForm;
    editingId: string | null;
    formOpen: boolean;
}

function getSavedDraft(): DestinationDraft | null {
    try {
        const saved = localStorage.getItem(DESTINATION_DRAFT_KEY);
        return saved ? JSON.parse(saved) as DestinationDraft : null;
    } catch {
        return null;
    }
}

export default function DestinationsPage() {
    const { isAdmin, isResortStaff, staffDestinationId } = useAuth();
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [savedDraft] = useState(getSavedDraft);

    const [formOpen, setFormOpen] = useState(
        savedDraft?.formOpen ?? false
    );

    const [editingId, setEditingId] = useState<string | null>(
        savedDraft?.editingId ?? null
    );

    const [form, setForm] = useState<DestinationForm>({
        ...emptyForm,
        ...savedDraft?.form,
        tags: savedDraft?.form?.tags ?? [],
    });


    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

    const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

    useEffect(() => {
        if (!selectedImage) {
            setSelectedImagePreview(null);
            return;
        }

        const previewUrl = URL.createObjectURL(selectedImage);
        setSelectedImagePreview(previewUrl);

        return () => URL.revokeObjectURL(previewUrl);
    }, [selectedImage]);

    function handleImageChange(file: File | undefined) {
        if (!file) return;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
        ];

        if (!allowedTypes.includes(file.type)) {
            setError("Please select a JPEG, PNG, or WebP image.");
            return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            setError("Image must not exceed 20 MB.");
            return;
        }

        setError("");
        setSelectedImage(file);
    }



    async function loadDestinations() {
        setLoading(true);
        setError("");

        let query = supabase
            .from("destinations")
            .select("id, slug, name, description, location, maps_url, image_url, latitude, longitude, tags, parking_available")
            .order("name", { ascending: true });

        if (isResortStaff) {
            if (!staffDestinationId) {
                setDestinations([]);
                setLoading(false);
                return;
            }

            query = query.eq("id", staffDestinationId);
        }

        const { data, error } = await query;

        if (error) {
            setError(error.message);
        } else {
            setDestinations(data ?? []);
        }

        setLoading(false);
    }

    useEffect(() => {
        loadDestinations();
    }, [isAdmin, isResortStaff, staffDestinationId]);

    function openCreateForm() {
        if (!isAdmin) return;
        setEditingId(null);
        setForm(emptyForm);
        setError("");
        setSuccess("");
        setFormOpen(true);
        setSelectedImage(null);
    }

    function openEditForm(destination: Destination) {
        if (
            !isAdmin &&
            (!isResortStaff || destination.id !== staffDestinationId)
        ) return;

        setEditingId(destination.id);
        setForm({
            slug: destination.slug,
            name: destination.name,
            parking_available: destination.parking_available ?? true,
            description: destination.description ?? "",
            location: destination.location ?? "",
            maps_url: destination.maps_url ?? "",
            image_url: destination.image_url ?? "",
            latitude: destination.latitude?.toString() ?? "",
            longitude: destination.longitude?.toString() ?? "",
            tags: destination.tags ?? [],
        });
        setError("");
        setSuccess("");
        setFormOpen(true);
        setSelectedImage(null);
    }

    function closeForm() {
        setFormOpen(false);
        setEditingId(null);
        setForm(emptyForm);
        setSelectedImage(null);
    }

    function updateField(field: keyof Omit<DestinationForm, "tags">, value: string) {
        setForm((current) => ({
            ...current,
            [field]: value,
            ...(field === "name" && !editingId
                ? { slug: createSlug(value) }
                : {}),
        }));
    }

    function toggleTag(tag: string) {
        setForm((current) => ({
            ...current,
            tags: current.tags.includes(tag)
                ? current.tags.filter((item) => item !== tag)
                : [...current.tags, tag],
        }));
    }

    function updateCoordinates(
        latitude: number | null,
        longitude: number | null
    ) {
        setForm((current) => ({
            ...current,
            latitude: latitude === null ? "" : latitude.toString(),
            longitude: longitude === null ? "" : longitude.toString(),
        }));
    }

    /* --------------------- Draft Management ----------------------- */
    useEffect(() => {
        if (formOpen) {
            const draft: DestinationDraft = {
                form,
                editingId,
                formOpen,
            };

            localStorage.setItem(
                DESTINATION_DRAFT_KEY,
                JSON.stringify(draft)
            );
        } else {
            localStorage.removeItem(DESTINATION_DRAFT_KEY);
        }
    }, [form, editingId, formOpen]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (
            !isAdmin &&
            (!isResortStaff ||
                !staffDestinationId ||
                !editingId ||
                editingId !== staffDestinationId)
        ) return;

        const latitude = form.latitude.trim() === ""
            ? null
            : Number(form.latitude);

        const longitude = form.longitude.trim() === ""
            ? null
            : Number(form.longitude);

        if (
            (latitude === null) !== (longitude === null) ||
            (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
            (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
        ) {
            setError("Enter both valid latitude and longitude values, or leave both empty.");
            return;
        }

        setSaving(true);
        setError("");
        setSuccess("");

        let imageUrl = form.image_url.trim() || null;

        if (selectedImage) {
            const extension = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp",
            }[selectedImage.type];

            const imagePath = `destinations/${crypto.randomUUID()}.${extension}`;

            const { error: uploadError } = await supabase.storage
                .from("media")
                .upload(imagePath, selectedImage, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: selectedImage.type,
                });

            if (uploadError) {
                setError(`Image upload failed: ${uploadError.message}`);
                setSaving(false);
                return;
            }

            const { data } = supabase.storage
                .from("media")
                .getPublicUrl(imagePath);

            imageUrl = data.publicUrl;
        }


        const payload = {
            slug: form.slug.trim(),
            name: form.name.trim(),
            parking_available: form.parking_available,
            description: form.description.trim() || null,
            location: form.location.trim() || null,
            maps_url: form.maps_url.trim() || null,
            image_url: imageUrl,
            latitude,
            longitude,
            tags: form.tags,
        };

        const result = editingId
            ? await supabase
                .from("destinations")
                .update(payload)
                .eq("id", editingId)
            : await supabase
                .from("destinations")
                .insert(payload);

        if (result.error) {
            setError(result.error.message);
            setSaving(false);
            return;
        }

        setSuccess(editingId
            ? "Destination updated successfully."
            : "Destination created successfully."
        );

        await loadDestinations();
        setSaving(false);
        closeForm();
    }

    async function handleDelete(destination: Destination) {
        if (!isAdmin) return;
        const confirmed = window.confirm(
            `Delete "${destination.name}"? This action cannot be undone.`
        );

        if (!confirmed) return;

        setError("");
        setSuccess("");

        const { error } = await supabase
            .from("destinations")
            .delete()
            .eq("id", destination.id);

        if (error) {
            setError(error.message);
            return;
        }

        setDestinations((current) =>
            current.filter((item) => item.id !== destination.id)
        );

        setSuccess(`${destination.name} was deleted.`);
    }

    return (
        <div className="admin-content destinations-page">
            <header className="admin-page-header admin-header-row">
                <div>
                    <p className="admin-eyebrow">
                        {isAdmin ? "CONTENT MANAGEMENT" : "RESORT INFORMATION"}
                    </p>
                    <h1>{isAdmin ? "Destinations" : "My Resort"}</h1>
                    <p>
                        {isAdmin
                            ? "Manage the resorts displayed in your directory."
                            : "View information about your assigned resort."}
                    </p>
                </div>

                {isAdmin && (
                    <button className="admin-primary-button" onClick={openCreateForm}>
                        <Plus size={18} />
                        Add destination
                    </button>
                )}
            </header>

            {error && <div className="admin-alert error">{error}</div>}
            {success && <div className="admin-alert success">{success}</div>}

            {(isAdmin || isResortStaff) && formOpen && (
                <section className="admin-form-panel">
                    <div className="admin-form-heading">
                        <div>
                            <h2>{editingId ? "Edit destination" : "New destination"}</h2>
                            <p>Enter the destination details below.</p>
                        </div>

                        <button
                            type="button"
                            className="admin-icon-button"
                            onClick={closeForm}
                            aria-label="Close form"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="admin-form">
                        <div className="admin-form-grid">
                            <label>
                                Destination name *
                                <input
                                    value={form.name}
                                    onChange={(e) => updateField("name", e.target.value)}
                                    placeholder="e.g. Balite Spring"
                                    required
                                />
                            </label>

                            <label>
                                Slug *
                                <input
                                    value={form.slug}
                                    onChange={(e) => updateField("slug", e.target.value)}
                                    placeholder="e.g. balite"
                                    required
                                />
                            </label>
                            <div className="full-width">
                                <label>
                                    Resort description
                                </label>

                                <DescriptionEditor
                                    value={form.description}
                                    onChange={(value) => updateField("description", value)}
                                />

                                <p className="admin-field-hint">
                                    Describe the resort, its facilities, amenities, and visitor experience.
                                    You can format paragraphs, headings, lists, and text alignment.
                                </p>
                            </div>
                            <label className="full-width">
                                Location
                                <input
                                    value={form.location}
                                    onChange={(e) => updateField("location", e.target.value)}
                                    placeholder="Destination address"
                                />
                            </label>

                            <label className="full-width">
                                Google Maps URL
                                <input
                                    type="url"
                                    value={form.maps_url}
                                    onChange={(e) => updateField("maps_url", e.target.value)}
                                    placeholder="https://maps.google.com/..."
                                />
                            </label>

                            <div className="full-width">
                                <LocationPicker
                                    latitude={
                                        form.latitude.trim() === ""
                                            ? null
                                            : Number(form.latitude)
                                    }
                                    longitude={
                                        form.longitude.trim() === ""
                                            ? null
                                            : Number(form.longitude)
                                    }
                                    onChange={updateCoordinates}
                                />
                            </div>

                            <div className="full-width destination-image-field">
                                <label htmlFor="destination-image">
                                    Main destination image
                                </label>

                                <input
                                    id="destination-image"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(e) => handleImageChange(e.target.files?.[0])}
                                />

                                <p className="admin-field-hint">
                                    Upload a JPEG, PNG, or WebP image. Maximum size: 20 MB.
                                </p>

                                {(selectedImagePreview || form.image_url) && (
                                    <div className="destination-image-preview">
                                        <img
                                            src={selectedImagePreview || form.image_url}
                                            alt="Destination preview"
                                        />

                                        <button
                                            type="button"
                                            className="admin-secondary-button"
                                            onClick={() => {
                                                setSelectedImage(null);
                                                setForm((current) => ({
                                                    ...current,
                                                    image_url: "",
                                                }));
                                            }}
                                        >
                                            Remove image
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="full-width">
                                <p><strong>Destination categories</strong></p>
                                <p>Select all categories that apply.</p>

                                <div className="destination-tag-options">
                                    {DESTINATION_TAGS.map((tag) => (
                                        <label
                                            key={tag}
                                            className="destination-tag-option"
                                        >
                                            <span>{tag}</span>

                                            <input
                                                type="checkbox"
                                                checked={form.tags.includes(tag)}
                                                onChange={() => toggleTag(tag)}
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="full-width">
                                <p><strong>Parking Availability</strong></p>

                                <label className="destination-parking-toggle">
                                    <input
                                        type="checkbox"
                                        checked={form.parking_available}
                                        onChange={(e) =>
                                            setForm((current) => ({
                                                ...current,
                                                parking_available: e.target.checked,
                                            }))
                                        }
                                    />
                                    <span>
                                        {form.parking_available ? "Available" : "Unavailable"}
                                    </span>
                                </label>

                                <p className="admin-field-hint">
                                    Toggle this depending on whether the resort currently offers parking.
                                </p>
                            </div>
                        </div>

                        <div className="admin-form-actions">
                            <button
                                type="button"
                                className="admin-secondary-button"
                                onClick={closeForm}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="admin-primary-button"
                                disabled={saving}
                            >
                                {saving
                                    ? "Saving..."
                                    : editingId
                                        ? "Save changes"
                                        : "Create destination"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <section className="admin-list-section">
                <div className="admin-list-heading">
                    <h2>{isAdmin ? "All destinations" : "My resort"}</h2>
                    <span>{destinations.length} total</span>
                </div>

                {loading ? (
                    <p className="admin-empty-state">Loading destinations...</p>
                ) : destinations.length === 0 ? (
                    <div className="admin-empty-state">
                        <MapPin size={32} />
                        <h3>{isResortStaff ? "No assigned resort found" : "No destinations yet"}</h3>
                        <p>
                            {isResortStaff
                                ? "Your account does not currently have an assigned resort."
                                : "Add your first destination to get started."}
                        </p>

                        {isAdmin && (
                            <button
                                className="admin-primary-button"
                                onClick={openCreateForm}
                            >
                                <Plus size={18} />
                                Add destination
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Destination</th>
                                    <th>Slug</th>
                                    <th>Location</th>
                                    <th>Categories</th>
                                    {(isAdmin || isResortStaff) && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {destinations.map((destination) => (
                                    <tr key={destination.id}>
                                        <td>
                                            <strong>{destination.name}</strong>
                                        </td>
                                        <td>{destination.slug}</td>
                                        <td>{destination.location || "—"}</td>
                                        <td>
                                            {destination.tags?.length
                                                ? destination.tags.join(", ")
                                                : "—"}
                                        </td>
                                        {(isAdmin || isResortStaff) && (
                                            <td>
                                                <div className="admin-row-actions">
                                                    <button
                                                        className="admin-icon-button"
                                                        onClick={() => openEditForm(destination)}
                                                        aria-label={`Edit ${destination.name}`}
                                                        title="Edit"
                                                    >
                                                        <Pencil size={17} />
                                                    </button>

                                                    {isAdmin && (
                                                        <button
                                                            className="admin-icon-button danger"
                                                            onClick={() => handleDelete(destination)}
                                                            aria-label={`Delete ${destination.name}`}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={17} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
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
