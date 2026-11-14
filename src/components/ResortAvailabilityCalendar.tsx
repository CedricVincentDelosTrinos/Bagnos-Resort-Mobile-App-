import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { supabase } from "../lib/supabase";

import "./ResortAvailabilityCalendar.css";

interface AvailabilityRecord {
    booking_date: string;
    availability_status: "Available" | "Fully Booked";
}

interface ResortAvailabilityCalendarProps {
    destinationId: string;
}

function getManilaToday() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === "year")?.value ?? "";
    const month = parts.find((part) => part.type === "month")?.value ?? "";
    const day = parts.find((part) => part.type === "day")?.value ?? "";

    return `${year}-${month}-${day}`;
}

function toDateKey(year: number, month: number, day: number) {
    return [
        year,
        String(month + 1).padStart(2, "0"),
        String(day).padStart(2, "0"),
    ].join("-");
}

export default function ResortAvailabilityCalendar({
    destinationId,
}: ResortAvailabilityCalendarProps) {
    const today = getManilaToday();

    const [monthStart, setMonthStart] = useState(() => {
        const [year, month] = today.split("-").map(Number);
        return new Date(year, month - 1, 1, 12);
    });

    const [availability, setAvailability] = useState<
        AvailabilityRecord[]
    >([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();

    const monthStartKey = toDateKey(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthEndKey = toDateKey(year, month, lastDay);

    const firstWeekday = new Date(year, month, 1).getDay();

    const currentMonth = today.slice(0, 7);
    const displayedMonth = monthStartKey.slice(0, 7);
    const isCurrentMonth = displayedMonth === currentMonth;

    useEffect(() => {
        let active = true;

        async function loadAvailability() {
            setLoading(true);
            setError("");
            setAvailability([]);

            const startDate =
                monthStartKey < today ? today : monthStartKey;

            const { data, error: rpcError } = await supabase.rpc(
                "get_public_resort_availability",
                {
                    p_destination_id: destinationId,
                    p_start_date: startDate,
                    p_end_date: monthEndKey,
                }
            );

            if (!active) return;

            if (rpcError) {
                console.error(
                    "Failed to load resort availability:",
                    rpcError
                );
                setError("Unable to load availability. Please try again.");
            } else {
                setAvailability(
                    (data ?? []) as AvailabilityRecord[]
                );
            }

            setLoading(false);
        }

        loadAvailability();

        return () => {
            active = false;
        };
    }, [destinationId, monthStartKey, monthEndKey, today]);

    const availabilityMap = new Map(
        availability.map((record) => [
            record.booking_date,
            record.availability_status,
        ])
    );

    function changeMonth(offset: number) {
        setMonthStart(
            (current) =>
                new Date(
                    current.getFullYear(),
                    current.getMonth() + offset,
                    1,
                    12
                )
        );
    }

    const monthLabel = new Intl.DateTimeFormat("en-PH", {
        month: "long",
        year: "numeric",
        timeZone: "Asia/Manila",
    }).format(monthStart);

    return (
        <section
            className="resort-availability"
            aria-label="Resort availability calendar"
        >
            <div className="resort-availability__heading">
                <div>
                    <h4>Visitor Availability</h4>
                    <p>Check available dates for this resort.</p>
                </div>
            </div>

            <div className="resort-availability__navigation">
                <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    disabled={isCurrentMonth}
                    aria-label="Previous month"
                >
                    <ChevronLeft size={19} />
                </button>

                <strong>{monthLabel}</strong>

                <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    aria-label="Next month"
                >
                    <ChevronRight size={19} />
                </button>
            </div>

            <div className="resort-availability__weekdays">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                        <span key={day}>{day}</span>
                    )
                )}
            </div>

            <div className="resort-availability__days">
                {Array.from({ length: firstWeekday }).map((_, index) => (
                    <span
                        key={`empty-${index}`}
                        className="resort-availability__empty"
                    />
                ))}

                {Array.from({ length: lastDay }, (_, index) => {
                    const day = index + 1;
                    const dateKey = toDateKey(year, month, day);
                    const isPast = dateKey < today;
                    const status = availabilityMap.get(dateKey);

                    return (
                        <div
                            key={dateKey}
                            className={[
                                "resort-availability__day",
                                isPast
                                    ? "resort-availability__day--past"
                                    : "",
                                status === "Available"
                                    ? "resort-availability__day--available"
                                    : "",
                                status === "Fully Booked"
                                    ? "resort-availability__day--booked"
                                    : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            aria-label={
                                isPast
                                    ? `${dateKey}, past date`
                                    : status
                                        ? `${dateKey}, ${status}`
                                        : `${dateKey}, availability unavailable`
                            }
                        >
                            <span>{day}</span>
                        </div>
                    );
                })}
            </div>

            <div className="resort-availability__legend">
                <span>
                    <i className="resort-availability__dot resort-availability__dot--available" />
                    Available
                </span>

                <span>
                    <i className="resort-availability__dot resort-availability__dot--booked" />
                    Fully Booked
                </span>
            </div>

            {loading && (
                <p className="resort-availability__message">
                    Loading availability...
                </p>
            )}

            {!loading && error && (
                <p
                    className="resort-availability__message resort-availability__message--error"
                    role="alert"
                >
                    {error}
                </p>
            )}

            {!loading && !error && availability.length === 0 && (
                <p className="resort-availability__message">
                    Availability is not currently available for this resort.
                </p>
            )}
        </section>
    );
}