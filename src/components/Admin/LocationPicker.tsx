import { OpenLocationCode } from "open-location-code";
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
    MapContainer,
    Marker,
    TileLayer,
    useMap,
    useMapEvents,
} from "react-leaflet";
import {
    Search,
    X,
    Maximize2,
    Minimize2,
} from "lucide-react";

import "leaflet/dist/leaflet.css";
import "./LocationPicker.css";


type Coordinates = [number, number];

interface LocationPickerProps {
    latitude: number | null;
    longitude: number | null;
    onChange: (latitude: number | null, longitude: number | null) => void;
}

interface SearchResult {
    id: string;
    name: string;
    address: string;
    coordinates: Coordinates;
}

interface PhotonFeature {
    geometry: {
        coordinates: [number, number];
    };
    properties: {
        name?: string;
        street?: string;
        housenumber?: string;
        city?: string;
        district?: string;
        state?: string;
        country?: string;
    };
}
const openLocationCode = new OpenLocationCode();
const DEFAULT_CENTER: Coordinates = [14.2, 121.3];

const pickerIcon = L.divIcon({
    className: "location-picker-marker",
    html: "<span></span>",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
});

const searchIcon = L.divIcon({
    className: "location-picker-search-marker",
    html: "<span></span>",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
});

function MapClickHandler({
    onChange,
}: {
    onChange: (latitude: number, longitude: number) => void;
}) {
    useMapEvents({
        click(event) {
            onChange(event.latlng.lat, event.latlng.lng);
        },
    });

    return null;
}

function MapPosition({
    position,
}: {
    position: Coordinates | null;
}) {
    const map = useMap();

    useEffect(() => {
        if (position) {
            map.setView(position, Math.max(map.getZoom(), 15));
        }
    }, [map, position]);

    return null;
}

function SearchMapPosition({
    position,
}: {
    position: Coordinates | null;
}) {
    const map = useMap();

    useEffect(() => {
        if (position) {
            map.setView(position, 16, {
                animate: true,
            });
        }
    }, [map, position]);

    return null;
}

function MapResize({ fullscreen }: { fullscreen: boolean }) {
    const map = useMap();

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            map.invalidateSize();
        }, 200);

        return () => window.clearTimeout(timeout);
    }, [map, fullscreen]);

    return null;
}

export default function LocationPicker({
    latitude,
    longitude,
    onChange,
}: LocationPickerProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [searchPosition, setSearchPosition] =
        useState<Coordinates | null>(null);
    const [fullscreen, setFullscreen] = useState(false);

    const hasValidPosition =
        latitude !== null &&
        longitude !== null &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180;

    const position = useMemo<Coordinates | null>(
        () =>
            hasValidPosition
                ? [latitude!, longitude!]
                : null,
        [hasValidPosition, latitude, longitude]
    );

    async function searchLocation() {
        const query = searchQuery.trim();

        if (!query) return;

        try {
            setSearching(true);
            setSearchError("");
            setSearchResults([]);
            setSearchPosition(null);

            // Detect a Plus Code inside the search query.
            const plusCodeMatch = query
                .toUpperCase()
                .match(/\b[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,7}\b/);

            const plusCode = plusCodeMatch?.[0] ?? null;

            // Remove the Plus Code to obtain the accompanying locality.
            const localityQuery = plusCode
                ? query
                    .replace(plusCodeMatch![0], "")
                    .replace(/^[,\s-]+|[,\s-]+$/g, "")
                    .trim()
                : query;

            async function fetchPhotonResults(
                searchText: string
            ): Promise<PhotonFeature[]> {
                const params = new URLSearchParams({
                    q: searchText,
                    limit: "5",
                    lat: DEFAULT_CENTER[0].toString(),
                    lon: DEFAULT_CENTER[1].toString(),
                    lang: "en",
                });

                const response = await fetch(
                    `https://photon.komoot.io/api/?${params.toString()}`
                );

                if (!response.ok) {
                    throw new Error("Location search failed.");
                }

                const data: { features: PhotonFeature[] } =
                    await response.json();

                return data.features;
            }

            let photonFeatures: PhotonFeature[] = [];
            let plusCodeResult: SearchResult | null = null;

            if (plusCode) {
                const isFullCode = plusCode.indexOf("+") === 8;

                if (isFullCode) {
                    // Full Plus Codes can be decoded without internet.
                    const area = openLocationCode.decode(plusCode);

                    plusCodeResult = {
                        id: `plus-code-${plusCode}`,
                        name: `Plus Code: ${plusCode}`,
                        address: localityQuery || "Plus Code location",
                        coordinates: [
                            area.latitudeCenter,
                            area.longitudeCenter,
                        ],
                    };
                } else {
                    // Short Plus Codes need a nearby reference location.
                    if (!localityQuery) {
                        setSearchError(
                            "Please include a nearby town, barangay, or address with the short Plus Code."
                        );
                        return;
                    }

                    // Try the complete locality first.
                    const localityQueries = [
                        localityQuery,
                        localityQuery.split(",").slice(1).join(",").trim(),
                    ].filter(
                        (value, index, array) =>
                            value && array.indexOf(value) === index
                    );

                    for (const locality of localityQueries) {
                        photonFeatures = await fetchPhotonResults(locality);

                        if (photonFeatures.length > 0) {
                            break;
                        }
                    }

                    if (photonFeatures.length === 0) {
                        setSearchError(
                            "Couldn't find the nearby locality. Try including a more recognizable town or city."
                        );
                        return;
                    }

                    const [referenceLongitude, referenceLatitude] =
                        photonFeatures[0].geometry.coordinates;

                    // Recover the complete Plus Code using the locality.
                    const fullCode = openLocationCode.recoverNearest(
                        plusCode,
                        referenceLatitude,
                        referenceLongitude
                    );

                    const area = openLocationCode.decode(fullCode);

                    plusCodeResult = {
                        id: `plus-code-${fullCode}`,
                        name: `Plus Code: ${plusCode}`,
                        address: localityQuery,
                        coordinates: [
                            area.latitudeCenter,
                            area.longitudeCenter,
                        ],
                    };
                }
            } else {
                // Ordinary address and place searches continue using Photon.
                photonFeatures = await fetchPhotonResults(localityQuery);
            }

            const results: SearchResult[] = photonFeatures
                .filter((feature) => {
                    const [longitude, latitude] =
                        feature.geometry.coordinates;

                    return (
                        Number.isFinite(latitude) &&
                        Number.isFinite(longitude) &&
                        latitude >= -90 &&
                        latitude <= 90 &&
                        longitude >= -180 &&
                        longitude <= 180
                    );
                })
                .map((feature, index) => {
                    const properties = feature.properties;

                    const name =
                        properties.name ||
                        properties.street ||
                        "Unnamed location";

                    const address = [
                        properties.housenumber,
                        properties.street,
                        properties.city,
                        properties.district,
                        properties.state,
                        properties.country,
                    ]
                        .filter(Boolean)
                        .filter(
                            (value, index, array) =>
                                array.indexOf(value) === index
                        )
                        .join(", ");

                    return {
                        id: `${index}-${name}`,
                        name,
                        address,
                        coordinates: [
                            feature.geometry.coordinates[1],
                            feature.geometry.coordinates[0],
                        ],
                    };
                });

            // Put the decoded Plus Code first in the results.
            if (plusCodeResult) {
                results.unshift(plusCodeResult);
            }

            setSearchResults(results);

            if (results.length === 0) {
                setSearchError("No matching locations found.");
            }
        } catch (error) {
            console.error("Location search error:", error);

            setSearchError(
                "Unable to search locations. Check your internet connection and try again."
            );
        } finally {
            setSearching(false);
        }
    }

    function selectSearchResult(result: SearchResult) {
        setSearchPosition(result.coordinates);
        setSearchQuery(result.name);
        setSearchResults([]);
        setSearchError("");
    }

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setFullscreen(false);
            }
        }

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    function handleCoordinateChange(
        newLatitude: number,
        newLongitude: number
    ) {
        setSearchPosition(null);
        onChange(newLatitude, newLongitude);
    }
    
    return (
        <div className="location-picker">
            <div className="location-picker__heading">
                <strong>Pin the resort location</strong>
                <p>
                    Search for a place or click the map to position
                    the marker. You can drag the marker to adjust
                    its exact position.
                </p>
            </div>

            <div
                className={`location-picker__map ${fullscreen
                    ? "location-picker__map--fullscreen"
                    : ""
                    }`}
            >

                <div className="location-picker__search">
                    <div className="location-picker__search-field">
                        <Search size={18} />

                        <input
                            type="search"
                            placeholder="Search an address or place..."
                            value={searchQuery}
                            onChange={(event) => {
                                setSearchQuery(event.target.value);
                                setSearchResults([]);
                                setSearchError("");
                            }}
                            aria-label="Search for a map location"
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    void searchLocation();
                                }
                            }}
                        />

                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery("");
                                    setSearchResults([]);
                                    setSearchError("");
                                }}
                                aria-label="Clear search"
                            >
                                <X size={17} />
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => void searchLocation()}
                            disabled={searching || !searchQuery.trim()}
                            aria-label="Search location"
                        >
                            {searching ? "..." : "Search"}
                        </button>
                    </div>

                    {searchError && (
                        <p className="location-picker__search-message">
                            {searchError}
                        </p>
                    )}

                    {searchResults.length > 0 && (
                        <div className="location-picker__results">
                            {searchResults.map((result) => (
                                <button
                                    type="button"
                                    key={result.id}
                                    onClick={() =>
                                        selectSearchResult(result)
                                    }
                                >
                                    <strong>{result.name}</strong>
                                    <span>
                                        {result.address ||
                                            "Address unavailable"}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {fullscreen && (
                    <button
                        type="button"
                        className="location-picker__fullscreen-close"
                        onClick={() => setFullscreen(false)}
                        aria-label="Exit full screen"
                        title="Exit full screen"
                    >
                        <Minimize2 size={20} />
                    </button>
                )}

                {!fullscreen && (
                    <button
                        type="button"
                        className="location-picker__fullscreen-button"
                        onClick={() => setFullscreen(true)}
                        aria-label="Enter full screen"
                        title="Enter full screen"
                    >
                        <Maximize2 size={20} />
                    </button>
                )}

                <MapContainer
                    center={position ?? DEFAULT_CENTER}
                    zoom={position ? 15 : 9}
                    scrollWheelZoom
                    className="location-picker__leaflet"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <MapClickHandler
                        onChange={handleCoordinateChange}
                    />

                    <MapPosition position={position} />

                    <SearchMapPosition position={searchPosition} />

                    <MapResize fullscreen={fullscreen} />
                    
                    {searchPosition && (
                        <Marker
                            position={searchPosition}
                            icon={searchIcon}
                        />
                    )}

                    {position && (
                        <Marker
                            position={position}
                            icon={pickerIcon}
                            draggable
                            eventHandlers={{
                                dragend(event) {
                                    const marker = event.target;
                                    const coordinates = marker.getLatLng();

                                    handleCoordinateChange(
                                        coordinates.lat,
                                        coordinates.lng
                                    );
                                },
                            }}
                        />
                    )}
                </MapContainer>
            </div>

            <div className="location-picker__coordinates">
                {position ? (
                    <>
                        <span>
                            Latitude: {position[0].toFixed(6)}
                        </span>
                        <span>
                            Longitude: {position[1].toFixed(6)}
                        </span>
                    </>
                ) : (
                    <span>No location selected yet.</span>
                )}
            </div>

            {position && (
                <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() => onChange(null, null)}
                >
                    Clear selected location
                </button>
            )}
        </div>
    );
}
