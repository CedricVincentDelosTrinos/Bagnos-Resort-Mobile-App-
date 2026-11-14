import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";

import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

interface AuthContextType {
    user: User | null;
    isAdmin: boolean;
    isResortStaff: boolean;
    isClient: boolean;
    staffDestinationId: string | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<string | null>;
    signInForAdmin: (
        email: string,
        password: string
    ) => Promise<string | null>;
    signUp: (
        email: string,
        password: string,
        fullName: string
    ) => Promise<string | null>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isResortStaff, setIsResortStaff] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [staffDestinationId, setStaffDestinationId] = useState<string | null>(null);

    const [authLoading, setAuthLoading] = useState(true);
    const [roleLoading, setRoleLoading] = useState(false);

    useEffect(() => {
        if (!isSupabaseConfigured) {
            setAuthLoading(false);
            return;
        }

        let mounted = true;

        async function initializeAuth() {
            const { data, error } = await supabase.auth.getSession();

            if (!mounted) return;

            if (error) {
                console.error("Session initialization failed:", error.message);
            }

            setUser(data.session?.user ?? null);
            setAuthLoading(false);
        }

        initializeAuth();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!isSupabaseConfigured || !user) {
            setIsAdmin(false);
            setIsResortStaff(false);
            setStaffDestinationId(null);
            setRoleLoading(false);
            setIsClient(false);
            return;
        }

        let active = true;

        async function checkUserRole() {
            setIsClient(false);
            setRoleLoading(true);

            setIsAdmin(false);
            setIsResortStaff(false);
            setStaffDestinationId(null);

            const { data: adminData, error: adminError } = await supabase
                .from("admin_users")
                .select("user_id")
                .eq("user_id", user!.id)
                .maybeSingle();

            if (!active) return;

            if (adminError) {
                console.error("Admin verification failed:", adminError.message);
            }

            if (!adminError && adminData) {
                setIsAdmin(true);
                setIsResortStaff(false);
                setStaffDestinationId(null);
                setRoleLoading(false);
                return;
            }

            const { data: staffData, error: staffError } = await supabase
                .from("resort_staff")
                .select("destination_id")
                .eq("user_id", user!.id)
                .eq("status", "active")
                .maybeSingle();

            if (!active) return;

            if (staffError) {
                console.error("Resort Staff verification failed:", staffError.message);
            }

            setIsResortStaff(!staffError && !!staffData);
            setStaffDestinationId(
                !staffError ? staffData?.destination_id ?? null : null
            );

            setIsClient(
                !adminError &&
                !staffError &&
                !adminData &&
                !staffData
            );

            setRoleLoading(false);
        }

        checkUserRole();

        return () => {
            active = false;
        };
    }, [user]);

    async function signIn(
        email: string,
        password: string
    ): Promise<string | null> {
        if (!isSupabaseConfigured) {
            return "Supabase has not been configured for this app yet.";
        }

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        return error?.message ?? null;
    }

    async function signInForAdmin(
        email: string,
        password: string
    ): Promise<string | null> {
        if (!isSupabaseConfigured) {
            return "Supabase has not been configured for this app yet.";
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError) {
            return signInError.message;
        }

        // Check whether the authenticated account is an Admin.
        const { data: adminData, error: adminError } = await supabase
            .from("admin_users")
            .select("user_id")
            .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
            .maybeSingle();

        if (adminError) {
            await supabase.auth.signOut();
            return "Unable to verify account permissions. Please try again.";
        }

        if (adminData) {
            return null;
        }

        // Otherwise, check whether the account is active Resort Staff.
        const userId = (await supabase.auth.getUser()).data.user?.id;

        const { data: staffData, error: staffError } = await supabase
            .from("resort_staff")
            .select("user_id")
            .eq("user_id", userId ?? "")
            .eq("status", "active")
            .maybeSingle();

        if (staffError) {
            await supabase.auth.signOut();
            return "Unable to verify account permissions. Please try again.";
        }

        if (staffData) {
            return null;
        }

        await supabase.auth.signOut();

        return "This account does not have Admin or Resort Staff access. Please use User / Client login.";
    }

    async function signUp(
        email: string,
        password: string,
        fullName: string
    ): Promise<string | null> {
        if (!isSupabaseConfigured) {
            return "Supabase has not been configured for this app yet.";
        }

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName.trim(),
                    account_type: "client",
                },
            },
        });

        return error?.message ?? null;
    }

    async function signOut() {
        if (!isSupabaseConfigured) return;

        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Sign out failed:", error.message);
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                isAdmin,
                isResortStaff,
                isClient,
                staffDestinationId,
                loading: authLoading || roleLoading,
                signIn,
                signInForAdmin,
                signUp,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used inside an AuthProvider.");
    }

    return context;
}