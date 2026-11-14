
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

function response(body: object, status = 200) {
    return Response.json(body, {
        status,
        headers: {
            ...corsHeaders,
            "Cache-Control": "no-store",
        },
    });
}

async function hashToken(token: string): Promise<string> {
    const encoded = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest("SHA-256", encoded);

    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return response({ error: "Method not allowed." }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
        return response(
            { error: "Missing Supabase configuration." },
            500
        );
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return response({ error: "Authentication required." }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    try {
        // 1. Verify the authenticated user.
        const token = authHeader.slice(7);

        const {
            data: { user },
            error: authError,
        } = await authClient.auth.getUser(token);

        if (authError || !user) {
            return response({ error: "Invalid session." }, 401);
        }

        if (!user.email) {
            return response(
                { error: "Your account does not have an email address." },
                400
            );
        }

        // 2. Validate the invitation token.
        const body = await req.json();

        const invitationToken =
            typeof body.token === "string"
                ? body.token.trim()
                : "";

        if (!/^[a-f0-9]{64}$/i.test(invitationToken)) {
            return response(
                { error: "Invalid invitation token." },
                400
            );
        }

        const tokenHash = await hashToken(invitationToken);
        const email = user.email.trim().toLowerCase();
        const now = new Date().toISOString();

        // 3. Prevent Admin accounts from becoming Resort Staff.
        const { data: adminRecord, error: adminError } =
            await adminClient
                .from("admin_users")
                .select("user_id")
                .eq("user_id", user.id)
                .maybeSingle();

        if (adminError) {
            console.error("Admin lookup failed:", adminError);

            return response(
                { error: "Could not verify account eligibility." },
                500
            );
        }

        if (adminRecord) {
            return response(
                { error: "Admin accounts cannot claim staff invitations." },
                403
            );
        }

        // 4. Prevent existing Resort Staff accounts from claiming invitations.
        const { data: staffRecord, error: staffError } =
            await adminClient
                .from("resort_staff")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();

        if (staffError) {
            console.error("Staff lookup failed:", staffError);

            return response(
                { error: "Could not verify account eligibility." },
                500
            );
        }

        if (staffRecord) {
            return response(
                { error: "This account already has a Resort Staff assignment." },
                409
            );
        }

        // 5. Prevent multiple pending applications.
        const { data: pendingApplication, error: applicationError } =
            await adminClient
                .from("staff_applications")
                .select("id")
                .eq("applicant_user_id", user.id)
                .eq("status", "pending")
                .maybeSingle();

        if (applicationError) {
            console.error("Application lookup failed:", applicationError);

            return response(
                { error: "Could not verify application eligibility." },
                500
            );
        }

        if (pendingApplication) {
            return response(
                { error: "You already have a pending staff application." },
                409
            );
        }

        // 6. Find the matching, unexpired invitation.
        const { data: invitation, error: invitationError } =
            await adminClient
                .from("staff_invitations")
                .select("id, email, expires_at")
                .eq("token_hash", tokenHash)
                .eq("status", "pending")
                .gt("expires_at", now)
                .eq("email", email)
                .maybeSingle();

        if (invitationError) {
            console.error("Invitation lookup failed:", invitationError);

            return response(
                { error: "Could not verify the invitation." },
                500
            );
        }

        if (!invitation) {
            return response(
                {
                    error:
                        "This invitation is invalid, expired, already used, or belongs to another email address.",
                },
                400
            );
        }

        // 7. Claim the invitation atomically.
        const claimedAt = new Date().toISOString();

        const { data: claimedInvitation, error: claimError } =
            await adminClient
                .from("staff_invitations")
                .update({
                    status: "claimed",
                    claimed_by: user.id,
                    claimed_at: claimedAt,
                })
                .eq("id", invitation.id)
                .eq("status", "pending")
                .gt("expires_at", claimedAt)
                .select("id, email, expires_at")
                .maybeSingle();

        if (claimError) {
            console.error("Invitation claim failed:", claimError);

            return response(
                { error: "Could not claim the invitation." },
                500
            );
        }

        if (!claimedInvitation) {
            return response(
                {
                    error:
                        "This invitation has already been claimed or has expired.",
                },
                409
            );
        }

        return response({
            success: true,
            invitation: {
                id: claimedInvitation.id,
                email: claimedInvitation.email,
                expires_at: claimedInvitation.expires_at,
            },
            message:
                "Invitation claimed successfully. You can now submit your resort application.",
        });

    } catch (error) {
        console.error("Claim Staff Invitation error:", error);

        return response(
            { error: "An unexpected error occurred." },
            500
        );
    }
});
