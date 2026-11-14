import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
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

        if (authError || !user) {
            return respond({ error: "Invalid or expired session." }, 401);
        }

        // Verify Admin access
        const { data: admin, error: adminError } = await adminClient
            .from("admin_users")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (adminError) {
            console.error("Admin verification failed:", adminError);
            return respond({ error: "Could not verify Admin access." }, 500);
        }

        if (!admin) {
            return respond({ error: "Admin access required." }, 403);
        }

        const body = await req.json();

        const applicationId = body.application_id;
        const action = body.action;
        const reviewNotes =
            typeof body.review_notes === "string"
                ? body.review_notes.trim()
                : null;

        if (
            typeof applicationId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                applicationId
            )
        ) {
            return respond({ error: "A valid application ID is required." }, 400);
        }

        if (!["approve", "reject", "delete"].includes(action)) {
            return respond({ error: "Invalid application action." }, 400);
        }

        if (reviewNotes !== null && reviewNotes.length > 2000) {
            return respond({
                error: "Review notes must not exceed 2,000 characters.",
            }, 400);
        }

        const { data, error } = await adminClient.rpc(
            "review_staff_application",
            {
                p_application_id: applicationId,
                p_action: action,
                p_reviewed_by: user.id,
                p_review_notes: reviewNotes,
            }
        );

        if (error) {
            console.error("Application review failed:", error);

            const message = error.message || "";

            if (
                message.includes("not found") ||
                message.includes("no longer exists")
            ) {
                return respond({ error: message }, 404);
            }

            if (
                message.includes("already") ||
                message.includes("invalid") ||
                message.includes("Unsupported")
            ) {
                return respond({ error: message }, 409);
            }

            return respond({
                error: message || "Could not process the application review.",
            }, 400);
        }

        return respond({
            message:
                action === "approve"
                    ? "Application approved successfully."
                    : action === "reject"
                        ? "Application rejected successfully."
                        : "Application deleted successfully.",
            result: data,
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        return respond(
            { error: "An unexpected server error occurred." },
            500
        );
    }
});