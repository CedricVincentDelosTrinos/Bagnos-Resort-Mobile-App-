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

    const adminClient = createClient(
        supabaseUrl,
        serviceRoleKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        }
    );

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
                { error: "Only Admins can permanently delete staff accounts." },
                403
            );
        }

        // 3. Validate the staff assignment ID.
        const body = await req.json();

        const staffId =
            typeof body.staff_id === "string"
                ? body.staff_id.trim()
                : "";

        const uuidPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidPattern.test(staffId)) {
            return response(
                { error: "Invalid staff assignment." },
                400
            );
        }

        // 4. Find the staff assignment.
        const { data: staffRecord, error: staffError } =
            await adminClient
                .from("resort_staff")
                .select(`
                    id,
                    user_id,
                    destination_id,
                    status,
                    created_at,
                    created_by
                `)
                .eq("id", staffId)
                .maybeSingle();


        if (staffError) {
            console.error("Staff lookup failed:", staffError);
            return response(
                { error: "Could not retrieve the staff assignment." },
                500
            );
        }

        if (!staffRecord) {
            return response(
                { error: "Staff assignment not found." },
                404
            );
        }

        if (staffRecord.user_id === caller.id) {
            return response(
                { error: "You cannot permanently delete your own account." },
                403
            );
        }

        // 5. Never delete an Admin account through this function.
        const { data: targetAdmin, error: targetAdminError } =
            await adminClient
                .from("admin_users")
                .select("user_id")
                .eq("user_id", staffRecord.user_id)
                .maybeSingle();

        if (targetAdminError) {
            console.error("Target Admin lookup failed:", targetAdminError);
            return response(
                { error: "Could not verify the target account." },
                500
            );
        }

        if (targetAdmin) {
            return response(
                { error: "Admin accounts cannot be deleted through staff management." },
                403
            );
        }

        // 6. Remove the staff assignment first.
        const { data: deletedAssignment, error: assignmentError } =
            await adminClient
                .from("resort_staff")
                .delete()
                .eq("id", staffId)
                .select("id")
                .maybeSingle();

        if (assignmentError || !deletedAssignment) {
            console.error(
                "Staff assignment deletion failed:",
                assignmentError
            );

            return response(
                { error: "Could not remove the staff assignment." },
                500
            );
        }

        // 7. Permanently delete the Auth account.
        const { error: deleteUserError } =
            await adminClient.auth.admin.deleteUser(
                staffRecord.user_id
            );

        if (deleteUserError) {
            console.error(
                "Auth account deletion failed:",
                deleteUserError
            );

            // Restore the assignment if Auth deletion fails.
            const { error: restoreError } = await adminClient
                .from("resort_staff")
                .insert(staffRecord);

            if (restoreError) {
                console.error(
                    "CRITICAL: Staff assignment restoration failed:",
                    restoreError
                );

                return response(
                    {
                        error:
                            "Auth deletion failed and the staff assignment could not be restored. Check the database immediately.",
                    },
                    500
                );
            }

            return response(
                {
                    error:
                        "The Auth account could not be deleted. The staff assignment was restored. Check the Edge Function logs for the reason.",
                },
                409
            );
        }

        return response({
            success: true,
            message: "Staff assignment and Auth account permanently deleted.",
        });
    } catch (error) {
        console.error("Delete Resort Staff error:", error);

        return response(
            { error: "An unexpected error occurred." },
            500
        );
    }
});