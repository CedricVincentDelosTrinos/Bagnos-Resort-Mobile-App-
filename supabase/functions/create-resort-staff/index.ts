import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

function generateTemporaryPassword() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);

    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

function response(body: object, status = 200) {
    return Response.json(body, {
        status,
        headers: {
            ...corsHeaders,
            "Cache-Control": "no-store",
        },
    });
}

async function findAuthUserByEmail(
    adminClient: ReturnType<typeof createClient>,
    email: string
) {
    const perPage = 1000;
    let page = 1;

    while (true) {
        const { data, error } =
            await adminClient.auth.admin.listUsers({
                page,
                perPage,
            });

        if (error) {
            throw new Error("Could not check existing Auth accounts.");
        }

        const existingUser = data.users.find(
            (user) => user.email?.toLowerCase() === email
        );

        if (existingUser) {
            return existingUser;
        }

        if (data.users.length < perPage) {
            return null;
        }

        page++;
    }
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

    const token = authHeader.slice(7);

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

    let newlyCreatedUserId: string | null = null;

    try {
        // 1. Verify the caller's authenticated identity.
        const {
            data: { user },
            error: authError,
        } = await authClient.auth.getUser(token);

        if (authError || !user) {
            return response({ error: "Invalid session." }, 401);
        }

        // 2. Confirm the caller is an Admin.
        const { data: adminRecord, error: adminError } =
            await adminClient
                .from("admin_users")
                .select("user_id")
                .eq("user_id", user.id)
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
                { error: "Only Admins can create Resort Staff accounts." },
                403
            );
        }

        // 3. Validate the request.
        const body = await req.json();

        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : "";

        const destinationId =
            typeof body.destination_id === "string"
                ? body.destination_id.trim()
                : "";

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const uuidPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!emailPattern.test(email)) {
            return response({ error: "Invalid email address." }, 400);
        }

        if (!uuidPattern.test(destinationId)) {
            return response({ error: "Invalid resort selection." }, 400);
        }

        // 4. Confirm that the selected resort exists.
        const { data: destination, error: destinationError } =
            await adminClient
                .from("destinations")
                .select("id, name")
                .eq("id", destinationId)
                .maybeSingle();

        if (destinationError) {
            console.error("Destination lookup failed:", destinationError);
            return response(
                { error: "Could not verify the selected resort." },
                500
            );
        }

        if (!destination) {
            return response({ error: "Resort not found." }, 404);
        }

        // 5. Find an existing Auth account, if one exists.
        const existingUser = await findAuthUserByEmail(
            adminClient,
            email
        );

        let staffUserId: string;
        let temporaryPassword: string | null = null;
        let accountReused = false;

        if (existingUser) {
            staffUserId = existingUser.id;
            accountReused = true;

            // An existing Admin must never become Resort Staff.
            const { data: existingAdmin, error: existingAdminError } =
                await adminClient
                    .from("admin_users")
                    .select("user_id")
                    .eq("user_id", staffUserId)
                    .maybeSingle();

            if (existingAdminError) {
                console.error(
                    "Existing Admin lookup failed:",
                    existingAdminError
                );
                return response(
                    { error: "Could not verify the existing account." },
                    500
                );
            }

            if (existingAdmin) {
                return response(
                    { error: "This email belongs to an Admin account and cannot be assigned as Resort Staff." },
                    409
                );
            }

            // An existing assignment must be managed through the staff list.
            const { data: existingAssignment, error: assignmentLookupError } =
                await adminClient
                    .from("resort_staff")
                    .select("id, destination_id, status")
                    .eq("user_id", staffUserId)
                    .maybeSingle();

            if (assignmentLookupError) {
                console.error(
                    "Staff assignment lookup failed:",
                    assignmentLookupError
                );
                return response(
                    { error: "Could not check the existing staff assignment." },
                    500
                );
            }

            if (existingAssignment) {
                return response(
                    {
                        error:
                            existingAssignment.status === "suspended"
                                ? "This account already has a suspended staff assignment. Reactivate it from Staff Management instead."
                                : "This account is already assigned to a resort. Remove its existing assignment before assigning it again.",
                    },
                    409
                );
            }
        } else {
            // 6. Create a new Auth account.
            temporaryPassword = generateTemporaryPassword();

            const { data: createdUser, error: createUserError } =
                await adminClient.auth.admin.createUser({
                    email,
                    password: temporaryPassword,
                    email_confirm: true,
                });

            if (createUserError || !createdUser.user) {
                console.error(
                    "Staff account creation failed:",
                    createUserError
                );

                return response(
                    {
                        error:
                            createUserError?.code === "email_exists"
                                ? "This email was registered during another request. Please try again."
                                : "Could not create the account.",
                    },
                    409
                );
            }

            staffUserId = createdUser.user.id;
            newlyCreatedUserId = staffUserId;
        }

        // 7. Assign the account to exactly one resort.
        const { error: assignmentError } = await adminClient
            .from("resort_staff")
            .insert({
                user_id: staffUserId,
                destination_id: destinationId,
                status: "active",
                created_by: user.id,
            });

        if (assignmentError) {
            console.error("Staff assignment failed:", assignmentError);

            // Only delete the Auth account if this function created it.
            if (newlyCreatedUserId) {
                const { error: rollbackError } =
                    await adminClient.auth.admin.deleteUser(
                        newlyCreatedUserId
                    );

                if (rollbackError) {
                    console.error(
                        "Could not roll back created account:",
                        rollbackError
                    );
                }
            }

            return response(
                { error: "Could not assign the account to the resort." },
                500
            );
        }

        // 8. Return the result.
        return response({
            success: true,
            account_reused: accountReused,
            staff: {
                user_id: staffUserId,
                email,
                destination_id: destination.id,
                destination_name: destination.name,
            },
            temporary_password: temporaryPassword,
            message: accountReused
                ? "Existing account assigned to the resort successfully. The account's existing password has not been changed."
                : "Staff account created and assigned successfully. Share the temporary password privately.",
        });
    } catch (error) {
        console.error("Create Resort Staff error:", error);

        // Safety rollback for a newly created account if an unexpected
        // error occurs after account creation.
        if (newlyCreatedUserId) {
            const { error: rollbackError } =
                await adminClient.auth.admin.deleteUser(
                    newlyCreatedUserId
                );

            if (rollbackError) {
                console.error(
                    "Unexpected-error rollback failed:",
                    rollbackError
                );
            }
        }

        return response(
            { error: "An unexpected error occurred." },
            500
        );
    }
});