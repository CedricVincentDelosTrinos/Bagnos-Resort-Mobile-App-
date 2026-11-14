
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return respond({ error: "Method not allowed." }, 405);
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const authorization = req.headers.get("Authorization");

        if (!authorization) {
            return respond({ error: "Authentication required." }, 401);
        }

        const authClient = createClient(supabaseUrl, anonKey, {
            global: {
                headers: { Authorization: authorization },
            },
        });

        const adminClient = createClient(supabaseUrl, serviceRoleKey);

        const {
            data: { user },
            error: authError,
        } = await authClient.auth.getUser();

        if (authError || !user || !user.email) {
            return respond({ error: "Invalid or expired session." }, 401);
        }

        const body = await req.json();

        const invitationId = body.invitation_id;
        const applicationType = body.application_type;
        const applicationMessage =
            typeof body.application_message === "string"
                ? body.application_message.trim()
                : null;

        if (!invitationId || typeof invitationId !== "string") {
            return respond({ error: "A valid invitation ID is required." }, 400);
        }

        if (
            applicationType !== "existing_resort" &&
            applicationType !== "new_resort"
        ) {
            return respond({ error: "Invalid application type." }, 400);
        }

        if (applicationMessage && applicationMessage.length > 2000) {
            return respond({ error: "Application message must not exceed 2,000 characters." }, 400);
        }

        const applicationData: Record<string, unknown> = {
            invitation_id: invitationId,
            applicant_user_id: user.id,
            applicant_email: user.email.toLowerCase().trim(),
            application_type: applicationType,
            application_message: applicationMessage || null,
            status: "pending",
        };

        if (applicationType === "existing_resort") {
            const destinationId = body.requested_destination_id;

            if (!destinationId || typeof destinationId !== "string") {
                return respond({ error: "Please select a resort." }, 400);
            }

            const { data: destination, error: destinationError } =
                await adminClient
                    .from("destinations")
                    .select("id")
                    .eq("id", destinationId)
                    .maybeSingle();

            if (destinationError) {
                console.error("Destination lookup failed:", destinationError);
                return respond({ error: "Could not verify the selected resort." }, 500);
            }

            if (!destination) {
                return respond({ error: "The selected resort does not exist." }, 404);
            }

            applicationData.requested_destination_id = destinationId;
        }

        if (applicationType === "new_resort") {
            const proposedResortName =
                typeof body.proposed_resort_name === "string"
                    ? body.proposed_resort_name.trim()
                    : "";

            const proposedResortLocation =
                typeof body.proposed_location === "string"
                    ? body.proposed_location.trim()
                    : "";

            if (!proposedResortName || !proposedResortLocation) {
                return respond({
                    error: "Resort name and location are required for a new resort proposal.",
                }, 400);
            }

            if (proposedResortName.length > 150 || proposedResortLocation.length > 255) {
                return respond({ error: "Resort name or location is too long." }, 400);
            }

            const optionalFields = [
                "proposed_address",
                "proposed_phone",
                "proposed_description",
                "proposed_maps_url",
            ];

            for (const field of optionalFields) {
                const value = body[field];

                if (value !== undefined && value !== null && typeof value !== "string") {
                    return respond({ error: `Invalid value for ${field}.` }, 400);
                }

                if (typeof value === "string" && value.length > 2000) {
                    return respond({ error: `${field} is too long.` }, 400);
                }
            }

            const latitude = body.proposed_latitude;
            const longitude = body.proposed_longitude;

            if (
                latitude !== undefined &&
                latitude !== null &&
                (typeof latitude !== "number" || latitude < -90 || latitude > 90)
            ) {
                return respond({ error: "Invalid latitude." }, 400);
            }

            if (
                longitude !== undefined &&
                longitude !== null &&
                (typeof longitude !== "number" || longitude < -180 || longitude > 180)
            ) {
                return respond({ error: "Invalid longitude." }, 400);
            }

            applicationData.proposed_resort_name = proposedResortName;
            applicationData.proposed_location = proposedResortLocation;
            applicationData.proposed_address =
                body.proposed_address?.trim() || null;
            applicationData.proposed_phone =
                body.proposed_phone?.trim() || null;
            applicationData.proposed_description =
                body.proposed_description?.trim() || null;
            applicationData.proposed_maps_url =
                body.proposed_maps_url?.trim() || null;
            applicationData.proposed_latitude = latitude ?? null;
            applicationData.proposed_longitude = longitude ?? null;
        }

        const { data: application, error: insertError } =
            await authClient
                .from("staff_applications")
                .insert(applicationData)
                .select("id, invitation_id, application_type, status, created_at")
                .single();

        if (insertError) {
            console.error("Application submission failed:", insertError);

            if (insertError.code === "23505") {
                return respond({
                    error: "You already have a pending application or this invitation has already been used.",
                }, 409);
            }

            if (insertError.code === "42501") {
                return respond({
                    error: "This invitation is not valid for your account, or it has not been claimed.",
                }, 403);
            }

            return respond({ error: "Could not submit your application." }, 500);
        }

        return respond({
            message: "Your application has been submitted successfully.",
            application,
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        return respond({ error: "An unexpected server error occurred." }, 500);
    }
});
