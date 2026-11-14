
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

function generateToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));

    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
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
        // 1. Verify the caller.
        const token = authHeader.slice(7);

        const {
            data: { user: caller },
            error: authError,
        } = await authClient.auth.getUser(token);

        if (authError || !caller) {
            return response({ error: "Invalid session." }, 401);
        }

        // 2. Confirm Admin access.
        const { data: adminRecord, error: adminError } =
            await adminClient
                .from("admin_users")
                .select("user_id")
                .eq("user_id", caller.id)
                .maybeSingle();

        if (adminError) {
            console.error("Admin verification failed:", adminError);

            return response(
                { error: "Could not verify Admin access." },
                500
            );
        }

        if (!adminRecord) {
            return response(
                { error: "Only Admins can create staff invitations." },
                403
            );
        }

        // 3. Validate the email.
        const body = await req.json();

        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : "";

        if (
            email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return response(
                { error: "Please provide a valid email address." },
                400
            );
        }

        // 4. Expire old pending invitations.
        const now = new Date().toISOString();

        const { error: expirationError } = await adminClient
            .from("staff_invitations")
            .update({ status: "expired" })
            .eq("status", "pending")
            .lte("expires_at", now);

        if (expirationError) {
            console.error(
                "Invitation expiration update failed:",
                expirationError
            );

            return response(
                { error: "Could not process existing invitations." },
                500
            );
        }

        // 5. Generate a secure invitation token.
        const invitationToken = generateToken();
        const tokenHash = await hashToken(invitationToken);

        const expiresAt = new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString();

        // 6. Store only the token hash.
        const { data: invitation, error: insertError } =
            await adminClient
                .from("staff_invitations")
                .insert({
                    email,
                    token_hash: tokenHash,
                    status: "pending",
                    invited_by: caller.id,
                    expires_at: expiresAt,
                })
                .select("id, email, expires_at")
                .single();

        if (insertError) {
            console.error("Invitation creation failed:", insertError);

            if (insertError.code === "23505") {
                return response(
                    {
                        error:
                            "A pending invitation already exists for this email address.",
                    },
                    409
                );
            }

            return response(
                { error: "Could not create the invitation." },
                500
            );
        }

        // 7. Return the raw token only once.
        return response({
            success: true,
            invitation: {
                id: invitation.id,
                email: invitation.email,
                expires_at: invitation.expires_at,
            },
            invitation_token: invitationToken,
            message: "Invitation created successfully.",
        });

    } catch (error) {
        console.error("Create Staff Invitation error:", error);

        return response(
            { error: "An unexpected error occurred." },
            500
        );
    }
});
