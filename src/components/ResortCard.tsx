
import { useState } from "react";
import { MapPin, Phone, Navigation, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import type { Destination } from "../types/destination";
import ResortAvailabilityCalendar from "./ResortAvailabilityCalendar";

import "./ResortCard.css";

interface ResortCardProps {
    destination: Destination;
    variant: "home" | "explore";
    mapUrl?: string;
}

export default function ResortCard({
    destination,
    variant,
    mapUrl,
}: ResortCardProps) {
    const [expanded, setExpanded] = useState(false);
    const navigate = useNavigate();

    const isHome = variant === "home";
    const cardClass = isHome ? "resort-card" : "explore-card";
    const contentClass = isHome
        ? "resort-card__content"
        : "explore-card__content";

    function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
        if (event.target !== event.currentTarget) return;

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((current) => !current);
        }
    }

    return (
        <article
            className={`${cardClass} ${expanded ? `${cardClass}--expanded` : ""}`}
            onClick={() => setExpanded((current) => !current)}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            aria-expanded={expanded}
        >
            <div className={`${cardClass}__image`}>
                {destination.image_url ? (
                    <img
                        src={destination.image_url}
                        alt={destination.name}
                        loading="lazy"
                    />
                ) : (
                    <>
                        <MapPin size={30} />
                        <span>
                            {isHome ? "Resort listing" : "Resort destination"}
                        </span>
                    </>
                )}
            </div>

            <div className={contentClass}>
                {isHome ? (
                    <h3>{destination.name}</h3>
                ) : (
                    <>
                        <span className="explore-card__location">
                            {destination.location || "Location unavailable"}
                        </span>
                        <h3>{destination.name}</h3>
                    </>
                )}

                {(destination.address || (isHome && destination.location)) && (
                    <div className={
                        isHome
                            ? "resort-card__detail"
                            : "explore-card__detail"
                    }>
                        <MapPin size={16} />
                        <span>
                            {destination.address || destination.location}
                        </span>
                    </div>
                )}

                {destination.landmark && isHome && (
                    <div className="resort-card__landmark">
                        <span>Nearby landmark</span>
                        <p>{destination.landmark}</p>
                    </div>
                )}

                {destination.tags?.length > 0 && (
                    <div className={
                        isHome
                            ? "resort-card__tags"
                            : "explore-card__tags"
                    }>
                        {destination.tags.map((tag) => (
                            <span key={tag}>{tag}</span>
                        ))}
                    </div>
                )}

                <div className={
                    isHome
                        ? "resort-card__actions"
                        : "explore-card__actions"
                }>
                    {isHome ? (
                        <>
                            {destination.phone && (
                                <a
                                    href={`tel:${destination.phone}`}
                                    className="resort-card__action resort-card__action--primary"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <Phone size={16} />
                                    Contact
                                </a>
                            )}

                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    navigate(
                                        `/map?destination=${encodeURIComponent(destination.id)}`
                                    );
                                }}
                                className="resort-card__action resort-card__action--secondary"
                            >
                                <Navigation size={16} />
                                Directions
                            </button>
                        </>
                    ) : (
                        mapUrl && (
                            <Link
                                to={mapUrl}
                                className="explore-card__button explore-card__button--secondary"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <MapPin size={16} />
                                View on map
                            </Link>
                        )
                    )}
                </div>

                <div className="resort-card__expand-indicator">
                    <span>{expanded ? "See less" : "See more"}</span>
                    <ChevronDown
                        size={18}
                        className={expanded ? "is-expanded" : ""}
                    />
                </div>

                {expanded && (
                    <div
                        className="resort-card__expanded"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {destination.description && (
                            <div className="resort-card__extra-detail">
                                <h4>About this resort</h4>
                                <div
                                    className="resort-card__description"
                                    dangerouslySetInnerHTML={{
                                        __html: destination.description,
                                    }}
                                />
                            </div>
                        )}

                        {destination.landmark && !isHome && (
                            <div className="resort-card__extra-detail">
                                <h4>Nearby landmark</h4>
                                <p>{destination.landmark}</p>
                            </div>
                        )}

                        {destination.phone && !isHome && (
                            <div className="resort-card__extra-detail">
                                <h4>Contact number</h4>
                                <p>{destination.phone}</p>
                            </div>
                        )}

                        {destination.operating_hours && (
                            <div className="resort-card__extra-detail">
                                <h4>Operating hours</h4>
                                <p>{destination.operating_hours}</p>
                            </div>
                        )}

                        {destination.transport_info && (
                            <div className="resort-card__extra-detail">
                                <h4>Transportation</h4>
                                <p>{destination.transport_info}</p>
                            </div>
                        )}
                        <div className="resort-card__extra-detail">
                            <h4>Parking availability</h4>
                            <p className={
                                destination.parking_available
                                    ? "parking-status parking-status--available"
                                    : "parking-status parking-status--unavailable"
                            }>
                                {destination.parking_available
                                    ? "Available"
                                    : "Unavailable"}
                            </p>
                        </div>
                        {destination.parking_info && (
                            <div className="resort-card__extra-detail">
                                <h4>Parking information</h4>
                                <p>{destination.parking_info}</p>
                            </div>
                        )}

                        {destination.road_conditions && (
                            <div className="resort-card__extra-detail">
                                <h4>Road conditions</h4>
                                <p>{destination.road_conditions}</p>
                            </div>
                        )}

                        <ResortAvailabilityCalendar
                            destinationId={destination.id}
                        />
                    </div>
                )}
            </div>
        </article>
    );
}
