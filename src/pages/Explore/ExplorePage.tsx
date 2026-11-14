import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    Search,
    X,
} from "lucide-react";

import { getDestinations } from "../../services/destinationService";
import type { Destination } from "../../types/destination";
import { DESTINATION_TAGS } from "../../config/destinationTags";

import "./ExplorePage.css";
import ResortCard from "../../components/ResortCard";

export default function ExplorePage() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState(
        () => searchParams.get("search") ?? ""
    );

    const [selectedTags, setSelectedTags] = useState<string[]>(
        () => searchParams.getAll("tag")
    );

    // Load destinations from Supabase.
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
                console.error("Failed to load destinations:", err);

                if (active) {
                    setError(
                        "Unable to load destinations. Please check your internet connection and try again."
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

    // Preserve search and selected tags in the URL.
    useEffect(() => {
        const nextParams = new URLSearchParams();
        const normalizedSearch = search.trim();

        if (normalizedSearch) {
            nextParams.set("search", normalizedSearch);
        }

        selectedTags.forEach((tag) => {
            nextParams.append("tag", tag);
        });

        setSearchParams(nextParams, { replace: true });
    }, [search, selectedTags, setSearchParams]);

    const exploreUrl = (() => {
        const params = new URLSearchParams();

        if (search.trim()) {
            params.set("search", search.trim());
        }

        selectedTags.forEach((tag) => {
            params.append("tag", tag);
        });

        return params.toString()
            ? `/explore?${params.toString()}`
            : "/explore";
    })();

    const filteredDestinations = useMemo(() => {
        const query = search.trim().toLowerCase();

        return destinations.filter((destination) => {
            const matchesSearch =
                !query ||
                destination.name.toLowerCase().includes(query) ||
                destination.slug.toLowerCase().includes(query) ||
                (destination.location ?? "").toLowerCase().includes(query) ||
                (destination.address ?? "").toLowerCase().includes(query) ||
                (destination.landmark ?? "").toLowerCase().includes(query);

            const matchesTags =
                selectedTags.length === 0 ||
                selectedTags.some((tag) =>
                    destination.tags?.includes(tag)
                );

            return matchesSearch && matchesTags;
        });
    }, [destinations, search, selectedTags]);

    function toggleTag(tag: string) {
        setSelectedTags((current) =>
            current.includes(tag)
                ? current.filter((item) => item !== tag)
                : [...current, tag]
        );
    }

    function clearFilters() {
        setSearch("");
        setSelectedTags([]);
    }

    return (
        <main className="explore-page">
            <section className="explore-intro">
                <p className="explore-eyebrow">DISCOVER LAGUNA</p>
                <h1>Explore destinations.</h1>
                <p>
                    Find a resort that fits your next getaway.
                    Search destinations or browse by category.
                </p>
            </section>

            <section className="explore-section">
                <div className="explore-section__heading">
                    <div>
                        <p className="explore-eyebrow">RESORT DIRECTORY</p>
                        <h2>Find a destination</h2>
                    </div>

                    <span className="explore-count">
                        {filteredDestinations.length}{" "}
                        {filteredDestinations.length === 1
                            ? "result"
                            : "results"}
                    </span>
                </div>

                <div className="explore-controls">
                    <div className="explore-search">
                        <Search size={18} />

                        <input
                            type="search"
                            placeholder="Search resorts or locations..."
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            aria-label="Search destinations"
                        />

                        {search && (
                            <button
                                type="button"
                                className="explore-clear"
                                onClick={() => setSearch("")}
                                aria-label="Clear search"
                            >
                                <X size={17} />
                            </button>
                        )}
                    </div>
                </div>

                <fieldset className="explore-tag-filters">
                    <legend>Filter by category</legend>

                    <div className="explore-tag-filters__options">
                        {DESTINATION_TAGS.map((tag) => (
                            <label
                                key={tag}
                                className="explore-tag-filter"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedTags.includes(tag)}
                                    onChange={() => toggleTag(tag)}
                                />
                                <span>{tag}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                {loading && (
                    <p className="explore-status">
                        Loading destinations...
                    </p>
                )}

                {error && (
                    <p className="explore-status explore-status--error">
                        {error}
                    </p>
                )}

                {!loading && !error && filteredDestinations.length > 0 && (
                    <div className="explore-results">
                        {filteredDestinations.map((destination) => {
                            const hasCoordinates =
                                typeof destination.latitude === "number" &&
                                typeof destination.longitude === "number";

                            const mapParams = new URLSearchParams({
                                destination: destination.id,
                                returnTo: exploreUrl,
                            });

                            const mapUrl = hasCoordinates
                                ? `/map?${mapParams.toString()}`
                                : undefined;

                            return (
                                <ResortCard
                                    key={destination.id}
                                    destination={destination}
                                    variant="explore"
                                    mapUrl={mapUrl}
                                />
                            );
                        })}
                    </div>
                )}

                {!loading &&
                    !error &&
                    filteredDestinations.length === 0 && (
                        <div className="explore-empty">
                            <Search size={30} />
                            <h3>No destinations found</h3>
                            <p>
                                Try another search term or change your
                                selected categories.
                            </p>

                            <button
                                type="button"
                                onClick={clearFilters}
                            >
                                Clear filters
                            </button>
                        </div>
                    )}
            </section>
        </main>
    );
}