
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap,
} from "react-leaflet";

import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react";

import { getDestinations } from "../../services/destinationService";
import type { Destination } from "../../types/destination";

import "leaflet/dist/leaflet.css";
import "./MapPage.css";

type Coordinates = [number, number];

const defaultCenter: Coordinates = [14.2, 121.3];

const resortIcon = L.divIcon({
    className: "resort-map-marker",
    html: "<span></span>",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
});


function MapBounds({
    positions,
    selectedPosition,
}: {
    positions: Coordinates[];
    selectedPosition?: Coordinates;
}) {
    const map = useMap();

    useEffect(() => {
        // Focus on the selected resort.
        if (selectedPosition) {
            map.setView(selectedPosition, 15, {
                animate: true,
            });
            return;
        }

        // Otherwise, show all available resorts.
        if (positions.length === 1) {
            map.setView(positions[0], 13);
            return;
        }

        if (positions.length > 1) {
            const bounds = L.latLngBounds(
                positions.map(([latitude, longitude]) =>
                    L.latLng(latitude, longitude)
                )
            );

            map.fitBounds(bounds, {
                padding: [40, 40],
                maxZoom: 13,
            });
        }
    }, [map, positions, selectedPosition]);

    return null;
}


export default function MapPage() {
    const [searchParams] = useSearchParams();

    const mapContainerRef = useRef<HTMLElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        function handleFullscreenChange() {
            setIsFullscreen(
                document.fullscreenElement === mapContainerRef.current
            );
        }

        document.addEventListener("fullscreenchange", handleFullscreenChange);

        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleFullscreenChange
            );
        };
    }, []);

    async function toggleFullscreen() {
        const container = mapContainerRef.current;

        if (!container) return;

        try {
            if (document.fullscreenElement === container) {
                await document.exitFullscreen();
            } else if (!document.fullscreenElement) {
                await container.requestFullscreen();
            }
        } catch (err) {
            console.error("Unable to toggle map fullscreen:", err);
        }
    }



    const requestedReturnTo = searchParams.get("returnTo");

    const returnTo =
        requestedReturnTo &&
            /^\/explore(?:\?|$)/.test(requestedReturnTo)
            ? requestedReturnTo
            : "/explore";

    const selectedDestinationId = searchParams.get("destination");

    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        async function loadDestinations() {
            try {
                setLoading(true);
                setError(null);

                const data = await getDestinations();

                if (active) {
                    setDestinations(data);
                }
            } catch (err) {
                console.error("Failed to load map destinations:", err);

                if (active) {
                    setError(
                        "Unable to load resort locations. Please check your internet connection and try again."
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadDestinations();

        return () => {
            active = false;
        };
    }, []);

    const mappedDestinations = useMemo(
        () =>
            destinations.filter(
                (destination) =>
                    typeof destination.latitude === "number" &&
                    typeof destination.longitude === "number" &&
                    Number.isFinite(destination.latitude) &&
                    Number.isFinite(destination.longitude) &&
                    destination.latitude >= -90 &&
                    destination.latitude <= 90 &&
                    destination.longitude >= -180 &&
                    destination.longitude <= 180
            ),
        [destinations]
    );

    const positions = useMemo(
        () =>
            mappedDestinations.map(
                (destination): Coordinates => [
                    destination.latitude!,
                    destination.longitude!,
                ]
            ),
        [mappedDestinations]
    );
    const selectedDestination = mappedDestinations.find(
        (destination) => destination.id === selectedDestinationId
    );

    const selectedPosition: Coordinates | undefined =
        selectedDestination
            ? [
                selectedDestination.latitude!,
                selectedDestination.longitude!,
            ]
            : undefined;
    return (
        <main className="map-page">
            <header className="map-page__header">
                <Link to={returnTo} className="map-page__back">
                    <ArrowLeft size={17} />
                    <span>Back to Explore</span>
                </Link>

                <p className="map-page__eyebrow">EXPLORE THE AREA</p>
                <h1>Resort Map</h1>
                <p>
                    {selectedDestination
                        ? `Showing location for ${selectedDestination.name}.`
                        : "Find resorts and explore their locations around Laguna."}
                </p>
            </header>

            {loading && (
                <p className="map-page__status">
                    Loading resort locations...
                </p>
            )}

            {error && (
                <p className="map-page__status map-page__status--error">
                    {error}
                </p>
            )}

            {!loading && !error && mappedDestinations.length === 0 && (
                <p className="map-page__status">
                    No resort coordinates available yet. Add latitude and
                    longitude through the admin dashboard to display resort
                    markers.
                </p>
            )}

            {!error && (
                <section
                    ref={mapContainerRef}
                    className={`map-page__container ${isFullscreen ? "map-page__container--fullscreen" : ""
                        }`}
                >
                    <button
                        type="button"
                        className="map-page__fullscreen-button"
                        onClick={toggleFullscreen}
                        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    >
                        {isFullscreen ? (
                            <Minimize2 size={20} />
                        ) : (
                            <Maximize2 size={20} />
                        )}
                        <span>{isFullscreen ? "Exit full screen" : "Full screen"}</span>
                    </button>
                    <MapContainer
                        center={defaultCenter}
                        zoom={9}
                        scrollWheelZoom={true}
                        className="map-page__map"
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        <MapBounds
                            positions={positions}
                            selectedPosition={selectedPosition}
                        />

                        {mappedDestinations.map((destination) => (
                            <Marker
                                key={destination.id}
                                position={[
                                    destination.latitude!,
                                    destination.longitude!,
                                ]}
                                icon={resortIcon}
                            >
                                <Popup>
                                    <div className="map-page__popup">
                                        <strong>{destination.name}</strong>

                                        {destination.location && (
                                            <p>{destination.location}</p>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </section>
            )}

            {!loading && !error && mappedDestinations.length > 0 && (
                <p className="map-page__count">
                    Showing {mappedDestinations.length} mapped{" "}
                    {mappedDestinations.length === 1 ? "resort" : "resorts"}
                </p>
            )}
        </main>
    );
}
