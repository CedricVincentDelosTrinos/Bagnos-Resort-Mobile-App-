
import { useEffect, useState, type FormEvent } from "react";
import {
    CalendarDays,
    Plus,
    Pencil,
    X,
    Users,
    Settings,
    RotateCcw,
    Trash2,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthContext";

import "./BookingsPage.css";

interface Destination {
    id: string;
    name: string;
}

interface BookingSettings {
    destination_id: string;
    standard_daily_capacity: number;
    is_booking_enabled: boolean;
}

interface Booking {
    id: string;
    destination_id: string;
    booking_date: string;
    group_name: string;
    guest_count: number;
    status: "active" | "cancelled";
    notes: string | null;
    created_by: string | null;
    created_at: string;
}

interface CapacityOverride {
    id: string;
    destination_id: string;
    booking_date: string;
    capacity: number;
    force_fully_booked: boolean;
    notes: string | null;
}

interface BookingForm {
    group_name: string;
    booking_date: string;
    guest_count: string;
    notes: string;
}

interface OverrideForm {
    booking_date: string;
    capacity: string;
    force_fully_booked: boolean;
    notes: string;
}

function getManilaDate() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value])
    );

    return `${values.year}-${values.month}-${values.day}`;
}

const emptyBookingForm: BookingForm = {
    group_name: "",
    booking_date: getManilaDate(),
    guest_count: "",
    notes: "",
};

const emptyOverrideForm: OverrideForm = {
    booking_date: getManilaDate(),
    capacity: "",
    force_fully_booked: false,
    notes: "",
};

export default function BookingsPage() {
    const { user, isAdmin, staffDestinationId } = useAuth();

    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [destinationId, setDestinationId] = useState("");
    const [settings, setSettings] = useState<BookingSettings | null>(null);

    const [bookings, setBookings] = useState<Booking[]>([]);
    const [overrides, setOverrides] = useState<CapacityOverride[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [capacity, setCapacity] = useState("0");
    const [bookingEnabled, setBookingEnabled] = useState(false);

    const [bookingFormOpen, setBookingFormOpen] = useState(false);
    const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
    const [bookingForm, setBookingForm] = useState<BookingForm>(emptyBookingForm);

    const [overrideFormOpen, setOverrideFormOpen] = useState(false);
    const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null);
    const [overrideForm, setOverrideForm] = useState<OverrideForm>(emptyOverrideForm);

    const [bookingFilter, setBookingFilter] = useState<"all" | "active" | "cancelled">("all");
    const [dateFilter, setDateFilter] = useState("");
    const [bookingSearch, setBookingSearch] = useState("");

    // Load resorts available to the current account.

    useEffect(() => {
        async function loadDestinations() {
            setLoading(true);
            setError("");

            if (!isAdmin && !staffDestinationId) {
                setDestinations([]);
                setDestinationId("");
                setLoading(false);
                return;
            }

            let query = supabase
                .from("destinations")
                .select("id, name")
                .order("name", { ascending: true });

            if (!isAdmin) {
                query = query.eq("id", staffDestinationId!);
            }

            const { data, error } = await query;

            if (error) {
                setError(error.message);
                setLoading(false);
                return;
            }

            const availableDestinations = data ?? [];

            setDestinations(availableDestinations);

            setDestinationId((current) => {
                if (availableDestinations.some((item) => item.id === current)) {
                    return current;
                }

                return availableDestinations[0]?.id ?? "";
            });

            setLoading(false);
        }

        loadDestinations();
    }, [isAdmin, staffDestinationId]);


    // Load settings, bookings, and capacity overrides for the selected resort.
    useEffect(() => {
        if (!destinationId) {
            setSettings(null);
            setBookings([]);
            setOverrides([]);
            return;
        }

        let cancelled = false;

        async function loadBookingData() {
            setLoading(true);
            setError("");

            const [settingsResult, bookingsResult, overridesResult] =
                await Promise.all([
                    supabase
                        .from("resort_booking_settings")
                        .select("*")
                        .eq("destination_id", destinationId)
                        .maybeSingle(),

                    supabase
                        .from("resort_bookings")
                        .select("*")
                        .eq("destination_id", destinationId)
                        .order("booking_date", { ascending: false }),

                    supabase
                        .from("resort_capacity_overrides")
                        .select("*")
                        .eq("destination_id", destinationId)
                        .order("booking_date", { ascending: true }),
                ]);

            if (cancelled) return;

            const firstError =
                settingsResult.error ||
                bookingsResult.error ||
                overridesResult.error;

            if (firstError) {
                setError(firstError.message);
                setLoading(false);
                return;
            }

            const loadedSettings = settingsResult.data as BookingSettings | null;

            setSettings(loadedSettings);
            setCapacity(
                String(loadedSettings?.standard_daily_capacity ?? 0)
            );
            setBookingEnabled(loadedSettings?.is_booking_enabled ?? false);
            setBookings((bookingsResult.data ?? []) as Booking[]);
            setOverrides((overridesResult.data ?? []) as CapacityOverride[]);
            setLoading(false);
        }

        loadBookingData();

        return () => {
            cancelled = true;
        };
    }, [destinationId]);

    function showSuccess(message: string) {
        setError("");
        setSuccess(message);
    }

    function openCreateBooking() {
        setEditingBookingId(null);
        setBookingForm({
            ...emptyBookingForm,
            booking_date: getManilaDate(),
        });
        setBookingFormOpen(true);
        setError("");
        setSuccess("");
    }

    function openEditBooking(booking: Booking) {
        setEditingBookingId(booking.id);
        setBookingForm({
            group_name: booking.group_name,
            booking_date: booking.booking_date,
            guest_count: String(booking.guest_count),
            notes: booking.notes ?? "",
        });
        setBookingFormOpen(true);
        setError("");
        setSuccess("");
    }

    function closeBookingForm() {
        setBookingFormOpen(false);
        setEditingBookingId(null);
        setBookingForm(emptyBookingForm);
    }

    async function saveSettings(event: FormEvent<HTMLFormElement>) {
        
        event.preventDefault();

        const parsedCapacity = Number(capacity);

        if (
            !Number.isInteger(parsedCapacity) ||
            parsedCapacity < 0
        ) {
            setError("Daily capacity must be a whole number of zero or greater.");
            return;
        }

        setSaving(true);
        setError("");
        setSuccess("");

        const { data, error } = await supabase
            .from("resort_booking_settings")
            .upsert(
                {
                    destination_id: destinationId,
                    standard_daily_capacity: parsedCapacity,
                    is_booking_enabled: bookingEnabled,
                },
                { onConflict: "destination_id" }
            )
            .select()
            .single();

        if (error) {
            setError(error.message);
        } else {
            setSettings(data as BookingSettings);
            showSuccess("Booking settings saved successfully.");
        }

        setSaving(false);
    }

    async function saveBooking(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const guestCount = Number(bookingForm.guest_count);

        if (
            !bookingForm.group_name.trim() ||
            !bookingForm.booking_date ||
            !Number.isInteger(guestCount) ||
            guestCount <= 0
        ) {
            setError("Enter a group name, valid date, and guest count greater than zero.");
            return;
        }

        setSaving(true);
        setError("");
        setSuccess("");

        const payload = {
            destination_id: destinationId,
            group_name: bookingForm.group_name.trim(),
            booking_date: bookingForm.booking_date,
            guest_count: guestCount,
            notes: bookingForm.notes.trim() || null,
        };

        const result = editingBookingId
            ? await supabase
                .from("resort_bookings")
                .update(payload)
                .eq("id", editingBookingId)
                .select()
                .single()
            : await supabase
                .from("resort_bookings")
                .insert({
                    ...payload,
                    created_by: user?.id ?? null,
                })
                .select()
                .single();

        if (result.error) {
            setError(result.error.message);
            setSaving(false);
            return;
        }

        const savedBooking = result.data as Booking;

        setBookings((current) => {
            const updated = editingBookingId
                ? current.map((item) =>
                    item.id === editingBookingId ? savedBooking : item
                )
                : [...current, savedBooking];

            return updated.sort((a, b) =>
                b.booking_date.localeCompare(a.booking_date)
            );
        });

        closeBookingForm();
        showSuccess(
            editingBookingId
                ? "Group booking updated successfully."
                : "Group booking added successfully."
        );
        setSaving(false);
    }

    async function toggleBookingStatus(booking: Booking) {
        const nextStatus = booking.status === "active" ? "cancelled" : "active";

        const confirmed = window.confirm(
            nextStatus === "cancelled"
                ? `Cancel the booking for "${booking.group_name}"? It will no longer count toward capacity.`
                : `Reactivate the booking for "${booking.group_name}"? It will count toward capacity again.`
        );

        if (!confirmed) return;

        setError("");
        setSuccess("");

        const { error } = await supabase
            .from("resort_bookings")
            .update({ status: nextStatus })
            .eq("id", booking.id);

        if (error) {
            setError(error.message);
            return;
        }

        setBookings((current) =>
            current.map((item) =>
                item.id === booking.id
                    ? { ...item, status: nextStatus }
                    : item
            )
        );

        showSuccess(
            nextStatus === "cancelled"
                ? "Booking cancelled. Its guests no longer count toward capacity."
                : "Booking reactivated successfully."
        );
    }

    function openCreateOverride() {
        
        setEditingOverrideId(null);
        setOverrideForm({
            ...emptyOverrideForm,
            booking_date: getManilaDate(),
            capacity: String(settings?.standard_daily_capacity ?? 0),
        });
        setOverrideFormOpen(true);
        setError("");
        setSuccess("");
    }

    function openEditOverride(item: CapacityOverride) {
        
        setEditingOverrideId(item.id);
        setOverrideForm({
            booking_date: item.booking_date,
            capacity: String(item.capacity),
            force_fully_booked: item.force_fully_booked,
            notes: item.notes ?? "",
        });
        setOverrideFormOpen(true);
        setError("");
        setSuccess("");
    }

    function closeOverrideForm() {
        setOverrideFormOpen(false);
        setEditingOverrideId(null);
        setOverrideForm(emptyOverrideForm);
    }

    async function saveOverride(event: FormEvent<HTMLFormElement>) {
        
        event.preventDefault();

        const parsedCapacity = Number(overrideForm.capacity);

        if (
            !overrideForm.booking_date ||
            !Number.isInteger(parsedCapacity) ||
            parsedCapacity < 0
        ) {
            setError("Enter a valid date and a whole-number capacity of zero or greater.");
            return;
        }

        setSaving(true);
        setError("");
        setSuccess("");

        const payload = {
            destination_id: destinationId,
            booking_date: overrideForm.booking_date,
            capacity: parsedCapacity,
            force_fully_booked: overrideForm.force_fully_booked,
            notes: overrideForm.notes.trim() || null,
        };

        const result = editingOverrideId
            ? await supabase
                .from("resort_capacity_overrides")
                .update(payload)
                .eq("id", editingOverrideId)
                .select()
                .single()
            : await supabase
                .from("resort_capacity_overrides")
                .upsert(payload, {
                    onConflict: "destination_id,booking_date",
                })
                .select()
                .single();

        if (result.error) {
            setError(result.error.message);
            setSaving(false);
            return;
        }

        const savedOverride = result.data as CapacityOverride;

        setOverrides((current) => {
            const updated = current.filter(
                (item) =>
                    item.id !== savedOverride.id &&
                    item.booking_date !== savedOverride.booking_date
            );

            return [...updated, savedOverride].sort((a, b) =>
                a.booking_date.localeCompare(b.booking_date)
            );
        });

        closeOverrideForm();
        showSuccess("Date-specific capacity saved successfully.");
        setSaving(false);
    }

    async function deleteOverride(item: CapacityOverride) {
        
        const confirmed = window.confirm(
            `Remove the capacity override for ${item.booking_date}? The resort's current standard capacity will apply again.`
        );

        if (!confirmed) return;

        const { error } = await supabase
            .from("resort_capacity_overrides")
            .delete()
            .eq("id", item.id);

        if (error) {
            setError(error.message);
            return;
        }

        setOverrides((current) =>
            current.filter((override) => override.id !== item.id)
        );

        showSuccess("Capacity override removed. Standard capacity now applies.");
    }

    const filteredBookings = bookings.filter((booking) => {
        const search = bookingSearch.trim().toLowerCase();

        const matchesSearch =
            !search ||
            booking.group_name.toLowerCase().includes(search) ||
            (booking.notes ?? "").toLowerCase().includes(search) ||
            booking.booking_date.includes(search);

        const matchesStatus =
            bookingFilter === "all" || booking.status === bookingFilter;

        const matchesDate =
            !dateFilter || booking.booking_date === dateFilter;

        return matchesSearch && matchesStatus && matchesDate;
    });

    const activeGuestCount = bookings
        .filter(
            (booking) =>
                booking.status === "active" &&
                booking.booking_date === getManilaDate()
        )
        .reduce((total, booking) => total + booking.guest_count, 0);

    const todayOverride = overrides.find(
        (item) => item.booking_date === getManilaDate()
    );

    const todayCapacity =
        todayOverride?.capacity ??
        settings?.standard_daily_capacity ??
        0;

    const todayFullyBooked =
        settings?.is_booking_enabled === true &&
        (
            todayOverride?.force_fully_booked === true ||
            activeGuestCount >= todayCapacity
        );

    if (loading && destinations.length === 0) {
        return (
            <div className="admin-content">
                <p className="admin-empty-state">Loading booking management...</p>
            </div>
        );
    }

    return (
        <div className="admin-content bookings-page">
            <header className="admin-page-header">
                <p className="admin-eyebrow">RESORT MANAGEMENT</p>
                <h1>Bookings</h1>
                <p>
                    Track group bookings and manage daily resort capacity.
                    Visitors only see availability, not private booking details.
                </p>
            </header>

            {error && <div className="admin-alert error">{error}</div>}
            {success && <div className="admin-alert success">{success}</div>}

            {destinations.length === 0 ? (
                <section className="admin-list-section">
                    <div className="admin-empty-state">
                        <CalendarDays size={32} />
                        <h3>No resort assigned</h3>
                        <p>
                            {isAdmin
                                ? "Create a resort listing before configuring bookings."
                                : "Your account does not currently have an active resort assignment."}
                        </p>
                    </div>
                </section>
            ) : (
                <>
                    <section className="booking-resort-selector">
                        <label htmlFor="booking-resort">Selected resort</label>
                        <select
                            id="booking-resort"
                            value={destinationId}
                            onChange={(event) => setDestinationId(event.target.value)}
                            disabled={!isAdmin}
                        >
                            {destinations.map((destination) => (
                                <option key={destination.id} value={destination.id}>
                                    {destination.name}
                                </option>
                            ))}
                        </select>
                    </section>

                    <section className="booking-overview-grid">
                        <article className="booking-overview-card">
                            <div className="booking-overview-icon">
                                <Users size={20} />
                            </div>
                            <div>
                                <span>Guests booked today</span>
                                <strong>{activeGuestCount}</strong>
                            </div>
                        </article>

                        <article className="booking-overview-card">
                            <div className="booking-overview-icon">
                                <CalendarDays size={20} />
                            </div>
                            <div>
                                <span>Today's capacity</span>
                                <strong>{todayCapacity}</strong>
                            </div>
                        </article>

                        <article className="booking-overview-card">
                            <div className="booking-overview-icon">
                                <Settings size={20} />
                            </div>
                            <div>
                                <span>Today's availability</span>
                                <strong
                                    className={
                                        !settings?.is_booking_enabled
                                            ? "disabled"
                                            : todayFullyBooked
                                                ? "fully-booked"
                                                : "available"
                                    }
                                >
                                    {!settings?.is_booking_enabled
                                        ? "Disabled"
                                        : todayFullyBooked
                                            ? "Fully Booked"
                                            : "Available"}
                                </strong>
                            </div>
                        </article>
                    </section>

                    <section className="admin-form-panel booking-settings-panel">
                        <div className="admin-form-heading">
                            <div>
                                <h2>Booking settings</h2>
                                <p>Configure the resort's standard daily guest capacity.</p>
                            </div>
                            <Settings size={21} />
                        </div>

                        <form onSubmit={saveSettings} className="admin-form">
                            <div className="booking-settings-fields">
                                <label>
                                    Standard daily capacity (guests)
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={capacity}
                                        onChange={(event) => setCapacity(event.target.value)}
                                        required
                                    />
                                </label>

                                <label className="admin-publish-toggle">
                                    <input
                                        type="checkbox"
                                        checked={bookingEnabled}
                                        onChange={(event) =>
                                            setBookingEnabled(event.target.checked)
                                        }
                                    />
                                    Enable public availability
                                </label>
                            </div>

                            <p className="admin-field-hint">
                                When disabled, the public calendar will not display availability
                                for this resort. Existing group records remain unchanged.
                            </p>

                            <div className="admin-form-actions">
                                <button
                                    type="submit"
                                    className="admin-primary-button"
                                    disabled={saving}
                                >
                                    {saving ? "Saving..." : "Save settings"}
                                </button>
                            </div>
                        </form>
                    </section>


                    <section className="admin-list-section">
                        <div className="booking-section-heading">
                            <div>
                                <h2>Group bookings</h2>
                                <p>Record groups confirmed through the resort's usual channels.</p>
                            </div>

                            <button
                                type="button"
                                className="admin-primary-button"
                                onClick={openCreateBooking}
                            >
                                <Plus size={17} />
                                Add booking
                            </button>
                        </div>

                        {bookingFormOpen && (
                            <form
                                onSubmit={saveBooking}
                                className="booking-editor"
                            >
                                <div className="admin-form-heading">
                                    <div>
                                        <h2>
                                            {editingBookingId ? "Edit group booking" : "New group booking"}
                                        </h2>
                                        <p>These details are private to resort management.</p>
                                    </div>

                                    <button
                                        type="button"
                                        className="admin-icon-button"
                                        onClick={closeBookingForm}
                                        aria-label="Close booking form"
                                    >
                                        <X size={19} />
                                    </button>
                                </div>

                                <div className="admin-form-grid">
                                    <label>
                                        Group name *
                                        <input
                                            value={bookingForm.group_name}
                                            onChange={(event) =>
                                                setBookingForm((current) => ({
                                                    ...current,
                                                    group_name: event.target.value,
                                                }))
                                            }
                                            maxLength={150}
                                            required
                                        />
                                    </label>

                                    <label>
                                        Booking date *
                                        <input
                                            type="date"
                                            value={bookingForm.booking_date}
                                            onChange={(event) =>
                                                setBookingForm((current) => ({
                                                    ...current,
                                                    booking_date: event.target.value,
                                                }))
                                            }
                                            required
                                        />
                                    </label>

                                    <label>
                                        Number of guests *
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={bookingForm.guest_count}
                                            onChange={(event) =>
                                                setBookingForm((current) => ({
                                                    ...current,
                                                    guest_count: event.target.value,
                                                }))
                                            }
                                            required
                                        />
                                    </label>

                                    <label className="full-width">
                                        Notes (optional)
                                        <textarea
                                            rows={3}
                                            value={bookingForm.notes}
                                            onChange={(event) =>
                                                setBookingForm((current) => ({
                                                    ...current,
                                                    notes: event.target.value,
                                                }))
                                            }
                                            maxLength={2000}
                                        />
                                    </label>
                                </div>

                                <div className="admin-form-actions">
                                    <button
                                        type="button"
                                        className="admin-secondary-button"
                                        onClick={closeBookingForm}
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
                                            : editingBookingId
                                                ? "Save changes"
                                                : "Add booking"}
                                    </button>
                                </div>
                            </form>
                        )}

                        <div className="booking-filters">

                            <input
                                type="search"
                                value={bookingSearch}
                                onChange={(event) => setBookingSearch(event.target.value)}
                                placeholder="Search group name, notes, or date..."
                                aria-label="Search group bookings"
                            />

                            <select
                                value={bookingFilter}
                                onChange={(event) =>
                                    setBookingFilter(event.target.value as typeof bookingFilter)
                                }
                                aria-label="Filter booking status"
                            >
                                <option value="all">All bookings</option>
                                <option value="active">Active</option>
                                <option value="cancelled">Cancelled</option>
                            </select>

                            <input
                                type="date"
                                value={dateFilter}
                                onChange={(event) => setDateFilter(event.target.value)}
                                aria-label="Filter by booking date"
                            />

                            {dateFilter && (
                                <button
                                    type="button"
                                    className="admin-secondary-button"
                                    onClick={() => setDateFilter("")}
                                >
                                    Clear date
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <p className="admin-empty-state">Loading bookings...</p>
                        ) : filteredBookings.length === 0 ? (
                            <div className="admin-empty-state">
                                <CalendarDays size={30} />
                                <h3>No bookings found</h3>
                                <p>There are no group bookings matching your filters.</p>
                            </div>
                        ) : (
                            <div className="admin-table-wrapper">
                                <table className="admin-table booking-table">
                                    <thead>
                                        <tr>
                                            <th>Group</th>
                                            <th>Date</th>
                                            <th>Guests</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBookings.map((booking) => (
                                            <tr key={booking.id}>
                                                <td>
                                                    <strong>{booking.group_name}</strong>
                                                    {booking.notes && (
                                                        <span className="booking-notes">
                                                            {booking.notes}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>{booking.booking_date}</td>
                                                <td>{booking.guest_count}</td>
                                                <td>
                                                    <span className={`booking-status ${booking.status}`}>
                                                        {booking.status === "active" ? "Active" : "Cancelled"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="admin-row-actions">
                                                        <button
                                                            type="button"
                                                            className="admin-icon-button"
                                                            onClick={() => openEditBooking(booking)}
                                                            title="Edit booking"
                                                            aria-label={`Edit ${booking.group_name}`}
                                                        >
                                                            <Pencil size={16} />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="admin-icon-button"
                                                            onClick={() => toggleBookingStatus(booking)}
                                                            title={booking.status === "active" ? "Cancel booking" : "Reactivate booking"}
                                                            aria-label={booking.status === "active" ? `Cancel ${booking.group_name}` : `Reactivate ${booking.group_name}`}
                                                        >
                                                            <RotateCcw size={16} />
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
                    
                        <section className="admin-list-section">
                            <div className="booking-section-heading">
                                <div>
                                    <h2>Capacity overrides</h2>
                                    <p>Set a different guest limit or manually close a date.</p>
                                </div>

                                <button
                                    type="button"
                                    className="admin-primary-button"
                                    onClick={openCreateOverride}
                                >
                                    <Plus size={17} />
                                    Add override
                                </button>
                            </div>

                            {overrideFormOpen && (
                                <form onSubmit={saveOverride} className="booking-editor">
                                    <div className="admin-form-heading">
                                        <div>
                                            <h2>
                                                {editingOverrideId ? "Edit capacity override" : "New capacity override"}
                                            </h2>
                                            <p>Overrides affect only the selected date.</p>
                                        </div>

                                        <button
                                            type="button"
                                            className="admin-icon-button"
                                            onClick={closeOverrideForm}
                                            aria-label="Close override form"
                                        >
                                            <X size={19} />
                                        </button>
                                    </div>

                                    <div className="admin-form-grid">
                                        <label>
                                            Date *
                                            <input
                                                type="date"
                                                value={overrideForm.booking_date}
                                                onChange={(event) =>
                                                    setOverrideForm((current) => ({
                                                        ...current,
                                                        booking_date: event.target.value,
                                                    }))
                                                }
                                                required
                                            />
                                        </label>

                                        <label>
                                            Capacity (guests) *
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={overrideForm.capacity}
                                                onChange={(event) =>
                                                    setOverrideForm((current) => ({
                                                        ...current,
                                                        capacity: event.target.value,
                                                    }))
                                                }
                                                required
                                            />
                                        </label>

                                        <label className="admin-publish-toggle full-width">
                                            <input
                                                type="checkbox"
                                                checked={overrideForm.force_fully_booked}
                                                onChange={(event) =>
                                                    setOverrideForm((current) => ({
                                                        ...current,
                                                        force_fully_booked: event.target.checked,
                                                    }))
                                                }
                                            />
                                            Manually mark this date as Fully Booked
                                        </label>

                                        <label className="full-width">
                                            Notes (optional)
                                            <textarea
                                                rows={3}
                                                value={overrideForm.notes}
                                                onChange={(event) =>
                                                    setOverrideForm((current) => ({
                                                        ...current,
                                                        notes: event.target.value,
                                                    }))
                                                }
                                                maxLength={2000}
                                            />
                                        </label>
                                    </div>

                                    <div className="admin-form-actions">
                                        <button
                                            type="button"
                                            className="admin-secondary-button"
                                            onClick={closeOverrideForm}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="admin-primary-button"
                                            disabled={saving}
                                        >
                                            {saving ? "Saving..." : "Save override"}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {overrides.length === 0 ? (
                                <div className="admin-empty-state">
                                    <Settings size={30} />
                                    <h3>No capacity overrides</h3>
                                    <p>The standard daily capacity currently applies to every date.</p>
                                </div>
                            ) : (
                                <div className="admin-table-wrapper">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Capacity</th>
                                                <th>Manual status</th>
                                                <th>Notes</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {overrides.map((item) => (
                                                <tr key={item.id}>
                                                    <td>{item.booking_date}</td>
                                                    <td>{item.capacity}</td>
                                                    <td>
                                                        {item.force_fully_booked
                                                            ? "Fully Booked"
                                                            : "Automatic"}
                                                    </td>
                                                    <td>{item.notes || "—"}</td>
                                                    <td>
                                                        <div className="admin-row-actions">
                                                            <button
                                                                type="button"
                                                                className="admin-icon-button"
                                                                onClick={() => openEditOverride(item)}
                                                                title="Edit override"
                                                                aria-label={`Edit override for ${item.booking_date}`}
                                                            >
                                                                <Pencil size={16} />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="admin-icon-button danger"
                                                                onClick={() => deleteOverride(item)}
                                                                title="Remove override"
                                                                aria-label={`Remove override for ${item.booking_date}`}
                                                            >
                                                                <Trash2 size={16} />
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
                </>
            )}
        </div>
    );
}
