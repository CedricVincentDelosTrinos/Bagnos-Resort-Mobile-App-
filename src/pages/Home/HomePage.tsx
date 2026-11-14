import { useEffect, useState } from "react";

import { getDestinations } from "../../services/destinationService";
import type { Destination } from "../../types/destination";

import "./HomePage.css";
import ResortCard from "../../components/ResortCard";

export default function HomePage() {
    const [resorts, setResorts] = useState<Destination[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadDestinations() {
            try {
                setLoading(true);
                setError(null);

                const data = await getDestinations();
                setResorts(data);
            } catch (err) {
                console.error("Failed to load destinations:", err);
                setError("Unable to load destinations. Please try again later.");
            } finally {
                setLoading(false);
            }
        }

        loadDestinations();
    }, []);

    return (
        <div className="home-page">
            <section className="home-intro">
                <p className="home-eyebrow">EXPLORE LAGUNA</p>
                <h1>Find your next escape.</h1>
                <p>
                    Discover resorts and hot spring destinations
                    for your next getaway.
                </p>
            </section>

            <section className="home-section">
                <div className="home-section__heading">
                    <div>
                        <p className="home-eyebrow">RESORT DIRECTORY</p>
                        <h2>Discover destinations</h2>
                    </div>

                    <span className="home-result-count">
                        {loading ? "Loading..." : `${resorts.length} listings`}
                    </span>
                </div>

                {loading ? (
                    <p>Loading destinations...</p>
                ) : error ? (
                    <p>{error}</p>
                ) : resorts.length === 0 ? (
                    <p>No destinations available yet.</p>
                ) : (
                    <div className="resort-feed">
                        {resorts.map((resort) => (
                            <ResortCard
                                key={resort.id}
                                destination={resort}
                                variant="home"
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}