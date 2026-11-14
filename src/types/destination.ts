
export interface Destination {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    address: string | null;
    landmark: string | null;
    phone: string | null;
    location: string | null;
    maps_url: string | null;
    image_url: string | null;
    latitude: number | null;
    longitude: number | null;
    operating_hours: string | null;
    transport_info: string | null;
    parking_info: string | null;
    road_conditions: string | null;
    tags: string[];
    created_at: string;
    updated_at: string | null;
    parking_available: boolean;
}

export type DestinationInput = Omit<
    Destination,
    "id" | "created_at" | "updated_at"
>;
