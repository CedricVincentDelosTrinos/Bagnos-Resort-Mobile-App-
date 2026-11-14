
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ArrowLeft,
    MessageSquare,
    Plus,
    Send,
    Users,
    Building2,
    User,
    RefreshCw,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabase";

import "./AdminMessagesPage.css";

type ConversationType = "client_admin" | "client_resort" | "admin_staff";
type FilterType = "all" | ConversationType;

interface Conversation {
    id: string;
    destination_id: string | null;
    created_by: string;
    subject: string;
    created_at: string;
    updated_at: string;
    last_message_at: string;
    conversation_type: ConversationType;
}

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    message: string;
    created_at: string;
    edited_at: string | null;
}

interface Destination {
    id: string;
    name: string;
}

interface StaffMember {
    user_id: string;
    email: string;
    destination_id: string;
}

interface ConversationSummary {
    conversation: Conversation;
    latestMessage: Message | null;
    unread: boolean;
}

export default function AdminMessagesPage() {
    const { user } = useAuth();
    const currentUserId = user?.id;

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [senderProfiles, setSenderProfiles] = useState<
        Record<string, string>
    >({});
    const [conversationClientNames, setConversationClientNames] = useState<
        Record<string, string>
    >({});
    const [readTimestamps, setReadTimestamps] = useState<
        Record<string, string>
    >({});

    const [selectedConversation, setSelectedConversation] =
        useState<Conversation | null>(null);

    const [filter, setFilter] = useState<FilterType>("all");
    const [messageText, setMessageText] = useState("");

    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [creatingConversation, setCreatingConversation] = useState(false);

    const [error, setError] = useState("");
    const [showNewConversation, setShowNewConversation] = useState(false);
    const [selectedDestinationId, setSelectedDestinationId] = useState("");
    const [selectedStaffId, setSelectedStaffId] = useState("");
    const [newSubject, setNewSubject] = useState("Staff Discussion");

    const loadInbox = useCallback(async () => {
        if (!currentUserId) return;

        setError("");

        const [
            conversationResult,
            destinationResult,
            staffResult,
            readResult,
        ] = await Promise.all([
            supabase
                .from("conversations")
                .select("*")
                .in("conversation_type", [
                    "client_admin",
                    "client_resort",
                    "admin_staff",
                ])
                .order("last_message_at", { ascending: false }),

            supabase
                .from("destinations")
                .select("id, name")
                .order("name"),

            supabase
                .from("resort_staff")
                .select("user_id, email, destination_id")
                .eq("status", "active"),

            supabase
                .from("conversation_reads")
                .select("conversation_id, last_read_at")
                .eq("user_id", currentUserId),
        ]);

        if (conversationResult.error) {
            console.error(conversationResult.error);
            setError("Unable to load the Admin inbox.");
            return;
        }

        if (destinationResult.error) {
            console.error(destinationResult.error);
        }

        if (staffResult.error) {
            console.error(staffResult.error);
        }

        if (readResult.error) {
            console.error(readResult.error);
        }

        const loadedConversations =
            (conversationResult.data ?? []) as Conversation[];

        setConversations(loadedConversations);
        setDestinations(destinationResult.data ?? []);
        setStaffMembers(staffResult.data ?? []);

        // Resolve client names for Client–Admin and Client–Resort conversations.
        const clientConversations = loadedConversations.filter(
            (conversation) =>
                conversation.conversation_type === "client_admin" ||
                conversation.conversation_type === "client_resort"
        );

        const clientUserIds = [
            ...new Set(clientConversations.map((conversation) => conversation.created_by)),
        ];

        const clientNames: Record<string, string> = {};

        if (clientUserIds.length > 0) {
            const { data: clients, error: clientError } = await supabase
                .from("client_profiles")
                .select("user_id, full_name")
                .in("user_id", clientUserIds);

            if (clientError) {
                console.error("Unable to load conversation client names:", clientError);
            }

            const namesByUserId: Record<string, string> = {};

            for (const client of clients ?? []) {
                namesByUserId[client.user_id] =
                    client.full_name?.trim() || "Client";
            }

            for (const conversation of clientConversations) {
                clientNames[conversation.id] =
                    namesByUserId[conversation.created_by] || "Client";
            }
        }

        setConversationClientNames(clientNames);

        const timestamps: Record<string, string> = {};

        for (const receipt of readResult.data ?? []) {
            timestamps[receipt.conversation_id] = receipt.last_read_at;
        }

        setReadTimestamps(timestamps);
    }, [currentUserId]);

    useEffect(() => {
        if (!currentUserId) return;

        let active = true;

        async function initialize() {
            setLoading(true);
            await loadInbox();

            if (active) setLoading(false);
        }

        void initialize();

        return () => {
            active = false;
        };
    }, [currentUserId, loadInbox]);

    // Refresh the inbox when conversations or messages change.
    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel(`admin-inbox-${currentUserId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "conversations",
                },
                () => {
                    void loadInbox();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                },
                () => {
                    void loadInbox();
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [currentUserId, loadInbox]);

    // Refresh when the Admin returns to the browser tab.
    useEffect(() => {
        function refreshOnReturn() {
            if (document.visibilityState === "visible") {
                void loadInbox();
            }
        }

        window.addEventListener("focus", refreshOnReturn);
        document.addEventListener("visibilitychange", refreshOnReturn);

        return () => {
            window.removeEventListener("focus", refreshOnReturn);
            document.removeEventListener("visibilitychange", refreshOnReturn);
        };
    }, [loadInbox]);

    const destinationName = useCallback(
        (destinationId: string | null) => {
            if (!destinationId) return "General";

            return (
                destinations.find((item) => item.id === destinationId)?.name ??
                "Resort"
            );
        },
        [destinations]
    );

    const getConversationTitle = useCallback(
        (conversation: Conversation) => {
            switch (conversation.conversation_type) {
                case "client_admin":
                case "client_resort":
                    return (
                        conversationClientNames[conversation.id] ||
                        "Client Inquiry"
                    );

                case "admin_staff":
                    return conversation.subject || "Staff Discussion";

                default:
                    return "Conversation";
            }
        },
        [conversationClientNames]
    );

    const getConversationCategory = (type: ConversationType) => {
        switch (type) {
            case "client_admin":
                return "Client – Admin";
            case "client_resort":
                return "Client – Resort";
            case "admin_staff":
                return "Admin – Staff";
        }
    };

    // Load messages and sender labels for the selected conversation.
    useEffect(() => {
        if (!selectedConversation || !currentUserId) {
            setMessages([]);
            return;
        }

        let active = true;
        const conversationId = selectedConversation.id;

        setMessages([]);
        setLoadingMessages(true);
        setError("");

        async function markAsRead() {
            const timestamp = new Date().toISOString();

            const { error: readError } = await supabase
                .from("conversation_reads")
                .upsert(
                    {
                        conversation_id: conversationId,
                        user_id: currentUserId,
                        last_read_at: timestamp,
                    },
                    { onConflict: "conversation_id,user_id" }
                );

            if (!readError && active) {
                setReadTimestamps((current) => ({
                    ...current,
                    [conversationId]: timestamp,
                }));
            }
        }

        async function loadMessages() {
            const { data, error: messageError } = await supabase
                .from("messages")
                .select("*")
                .eq("conversation_id", conversationId)
                .order("created_at", { ascending: true });

            if (!active) return;

            if (messageError) {
                console.error(messageError);
                setError("Unable to load this conversation.");
                setLoadingMessages(false);
                return;
            }

            const loadedMessages = (data ?? []) as Message[];
            setMessages(loadedMessages);

            const senderIds = [
                ...new Set(loadedMessages.map((item) => item.sender_id)),
            ];

            if (senderIds.length > 0) {
                const [clients, staff, admins] = await Promise.all([
                    supabase
                        .from("client_profiles")
                        .select("user_id, full_name, email")
                        .in("user_id", senderIds),

                    supabase
                        .from("resort_staff")
                        .select("user_id, destination_id")
                        .in("user_id", senderIds),

                    supabase
                        .from("admin_users")
                        .select("user_id")
                        .in("user_id", senderIds),
                ]);

                if (!active) return;

                const profiles: Record<string, string> = {};

                // Client: use their registered full name.
                for (const item of clients.data ?? []) {
                    profiles[item.user_id] =
                        item.full_name?.trim() || "Client";
                }

                // Resort Staff: use their assigned resort name.
                for (const item of staff.data ?? []) {
                    const resort = destinations.find(
                        (destination) => destination.id === item.destination_id
                    );

                    profiles[item.user_id] = resort?.name || "Resort";
                }

                // Admin: always display Admin.
                for (const item of admins.data ?? []) {
                    profiles[item.user_id] = "Admin";
                }

                setSenderProfiles(profiles);
            }

            await markAsRead();

            if (active) setLoadingMessages(false);
        }

        const channel = supabase
            .channel(`admin-thread-${conversationId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const incoming = payload.new as Message;

                    setMessages((current) => {
                        if (current.some((item) => item.id === incoming.id)) {
                            return current;
                        }

                        return [...current, incoming];
                    });

                    if (incoming.sender_id !== currentUserId) {
                        void markAsRead();
                    }
                }
            )
            .subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    void loadMessages();
                }
            });

        return () => {
            active = false;
            void supabase.removeChannel(channel);
        };
    }, [selectedConversation, currentUserId, destinations]);

    const summaries = useMemo(() => {
        return conversations.map((conversation) => {
            const latestMessage =
                messages
                    .filter(
                        (message) =>
                            message.conversation_id === conversation.id
                    )
                    .at(-1) ?? null;

            const lastRead = readTimestamps[conversation.id];

            const unread =
                latestMessage !== null &&
                latestMessage.sender_id !== currentUserId &&
                (!lastRead ||
                    new Date(latestMessage.created_at).getTime() >
                    new Date(lastRead).getTime());

            return {
                conversation,
                latestMessage,
                unread,
            } satisfies ConversationSummary;
        });
    }, [conversations, messages, readTimestamps, currentUserId]);

    const filteredSummaries = useMemo(() => {
        return summaries.filter(({ conversation }) => {
            return filter === "all" || conversation.conversation_type === filter;
        });
    }, [summaries, filter]);

    const unreadCount = summaries.filter((item) => item.unread).length;

    const availableStaff = staffMembers.filter(
        (staff) => staff.destination_id === selectedDestinationId
    );

    async function createStaffConversation() {
        if (
            !currentUserId ||
            !selectedDestinationId ||
            !selectedStaffId ||
            creatingConversation
        ) {
            return;
        }

        setCreatingConversation(true);
        setError("");

        try {
            const { data, error: rpcError } = await supabase.rpc(
                "create_admin_staff_conversation",
                {
                    p_other_user_id: selectedStaffId,
                    p_destination_id: selectedDestinationId,
                    p_subject: newSubject.trim() || "Staff Discussion",
                }
            );

            if (rpcError) throw rpcError;

            if (!data) {
                throw new Error("The conversation could not be created.");
            }

            await loadInbox();

            const { data: conversation, error: fetchError } = await supabase
                .from("conversations")
                .select("*")
                .eq("id", data)
                .single();

            if (fetchError || !conversation) {
                throw fetchError ?? new Error("Unable to open the conversation.");
            }

            setSelectedConversation(conversation as Conversation);
            setShowNewConversation(false);
            setSelectedDestinationId("");
            setSelectedStaffId("");
            setNewSubject("Staff Discussion");
        } catch (err) {
            console.error("Unable to create staff conversation:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to start the staff conversation."
            );
        } finally {
            setCreatingConversation(false);
        }
    }

    async function sendMessage() {
        if (
            !currentUserId ||
            !selectedConversation ||
            !messageText.trim() ||
            sending
        ) {
            return;
        }

        setSending(true);
        setError("");

        const { error: sendError } = await supabase.from("messages").insert({
            conversation_id: selectedConversation.id,
            sender_id: currentUserId,
            message: messageText.trim(),
        });

        if (sendError) {
            console.error(sendError);
            setError("Unable to send your message. Please try again.");
        } else {
            setMessageText("");
        }

        setSending(false);
    }

    if (loading) {
        return (
            <div className="admin-messages-loading">
                <RefreshCw size={20} className="admin-messages-spin" />
                Loading messages...
            </div>
        );
    }

    return (
        <section className="admin-messages">
            <header className="admin-messages__heading">
                <div>
                    <span className="admin-messages__eyebrow">
                        COMMUNICATION CENTER
                    </span>
                    <h1>Messages</h1>
                    <p>Manage client and resort staff conversations.</p>
                </div>

                <button
                    type="button"
                    className="admin-messages__new-button"
                    onClick={() => setShowNewConversation(true)}
                >
                    <Plus size={18} />
                    <span>New Staff Chat</span>
                </button>
            </header>

            {error && (
                <div className="admin-messages__error" role="alert">
                    {error}
                </div>
            )}

            <div className="admin-messages__workspace">
                <aside
                    className={`admin-messages__sidebar ${selectedConversation
                        ? "admin-messages__sidebar--hidden"
                        : ""
                        }`}
                >
                    <div className="admin-messages__sidebar-heading">
                        <div>
                            <h2>Inbox</h2>
                            <span>
                                {conversations.length} conversations
                                {unreadCount > 0 && ` · ${unreadCount} unread`}
                            </span>
                        </div>

                        <button
                            type="button"
                            className="admin-messages__refresh"
                            onClick={() => void loadInbox()}
                            aria-label="Refresh inbox"
                            title="Refresh inbox"
                        >
                            <RefreshCw size={17} />
                        </button>
                    </div>

                    <div className="admin-messages__filters">
                        {(
                            [
                                ["all", "All"],
                                ["client_admin", "Client – Admin"],
                                ["client_resort", "Client – Resort"],
                                ["admin_staff", "Admin – Staff"],
                            ] as [FilterType, string][]
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                className={
                                    filter === value
                                        ? "admin-messages__filter admin-messages__filter--active"
                                        : "admin-messages__filter"
                                }
                                onClick={() => setFilter(value)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="admin-messages__conversation-list">
                        {filteredSummaries.length === 0 ? (
                            <div className="admin-messages__empty">
                                <MessageSquare size={27} />
                                <p>No conversations found.</p>
                            </div>
                        ) : (
                            filteredSummaries.map(
                                ({ conversation, latestMessage, unread }) => (
                                    <button
                                        key={conversation.id}
                                        type="button"
                                        className={`admin-messages__conversation ${selectedConversation?.id ===
                                            conversation.id
                                            ? "admin-messages__conversation--active"
                                            : ""
                                            }`}
                                        onClick={() =>
                                            setSelectedConversation(conversation)
                                        }
                                    >
                                        <span className="admin-messages__avatar">
                                            {conversation.conversation_type ===
                                                "client_admin" ? (
                                                <User size={19} />
                                            ) : conversation.conversation_type ===
                                                "client_resort" ? (
                                                <Building2 size={19} />
                                            ) : (
                                                <Users size={19} />
                                            )}
                                        </span>

                                        <span className="admin-messages__conversation-content">
                                            <span className="admin-messages__conversation-top">
                                                <strong>
                                                    {getConversationTitle(
                                                        conversation
                                                    )}
                                                </strong>
                                                <small>
                                                    {new Date(
                                                        conversation.last_message_at
                                                    ).toLocaleDateString([], {
                                                        month: "short",
                                                        day: "numeric",
                                                    })}
                                                </small>
                                            </span>

                                            <span className="admin-messages__category">
                                                {getConversationCategory(conversation.conversation_type)}
                                                {conversation.conversation_type === "client_resort" &&
                                                    ` · ${destinationName(conversation.destination_id)}`}
                                            </span>

                                            <span className="admin-messages__preview">
                                                {latestMessage?.message ??
                                                    conversation.subject ??
                                                    "No messages yet"}
                                            </span>
                                        </span>

                                        {unread && (
                                            <span
                                                className="admin-messages__unread-dot"
                                                aria-label="Unread messages"
                                            />
                                        )}
                                    </button>
                                )
                            )
                        )}
                    </div>
                </aside>

                <main
                    className={`admin-messages__thread ${!selectedConversation
                        ? "admin-messages__thread--empty"
                        : ""
                        }`}
                >
                    {!selectedConversation ? (
                        <div className="admin-messages__welcome">
                            <span>
                                <MessageSquare size={32} />
                            </span>
                            <h2>Your message inbox</h2>
                            <p>
                                Select a conversation to read and reply to
                                messages.
                            </p>
                        </div>
                    ) : (
                        <>
                            <header className="admin-messages__thread-header">
                                <button
                                    type="button"
                                    className="admin-messages__back"
                                    onClick={() =>
                                        setSelectedConversation(null)
                                    }
                                    aria-label="Back to inbox"
                                >
                                    <ArrowLeft size={20} />
                                </button>

                                <div>
                                    <h2>
                                        {getConversationTitle(
                                            selectedConversation
                                        )}
                                    </h2>
                                    <p>
                                        {getConversationCategory(
                                            selectedConversation.conversation_type
                                        )}
                                        {selectedConversation.destination_id &&
                                            ` · ${destinationName(
                                                selectedConversation.destination_id
                                            )}`}
                                    </p>
                                </div>
                            </header>

                            <div className="admin-messages__history">
                                {loadingMessages ? (
                                    <div className="admin-messages__history-loading">
                                        Loading conversation...
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="admin-messages__empty">
                                        <MessageSquare size={25} />
                                        <p>No messages in this conversation yet.</p>
                                    </div>
                                ) : (
                                    messages.map((message) => {
                                        const own =
                                            message.sender_id === currentUserId;

                                        return (
                                            <div
                                                key={message.id}
                                                className={`admin-message ${own
                                                    ? "admin-message--own"
                                                    : "admin-message--other"
                                                    }`}
                                            >
                                                {!own && (
                                                    <span className="admin-message__sender">
                                                        {senderProfiles[message.sender_id] ?? "Conversation participant"}
                                                    </span>
                                                )}

                                                <div className="admin-message__bubble">
                                                    <p>{message.message}</p>
                                                    <small>
                                                        {new Date(
                                                            message.created_at
                                                        ).toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </small>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <form
                                className="admin-messages__composer"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void sendMessage();
                                }}
                            >
                                <input
                                    value={messageText}
                                    onChange={(event) =>
                                        setMessageText(event.target.value)
                                    }
                                    placeholder="Write a message..."
                                    maxLength={5000}
                                />

                                <button
                                    type="submit"
                                    disabled={!messageText.trim() || sending}
                                    aria-label="Send message"
                                >
                                    <Send size={19} />
                                </button>
                            </form>
                        </>
                    )}
                </main>
            </div>

            {showNewConversation && (
                <div
                    className="admin-messages__modal-overlay"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setShowNewConversation(false);
                        }
                    }}
                >
                    <div
                        className="admin-messages__modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="new-staff-chat-title"
                    >
                        <div className="admin-messages__modal-heading">
                            <span>
                                <Users size={22} />
                            </span>
                            <div>
                                <h2 id="new-staff-chat-title">
                                    New Staff Conversation
                                </h2>
                                <p>
                                    Start a private conversation with Resort
                                    Staff.
                                </p>
                            </div>
                        </div>

                        <label htmlFor="staff-destination">
                            Resort
                        </label>
                        <select
                            id="staff-destination"
                            value={selectedDestinationId}
                            onChange={(event) => {
                                setSelectedDestinationId(event.target.value);
                                setSelectedStaffId("");
                            }}
                        >
                            <option value="">Select a resort</option>
                            {destinations.map((destination) => (
                                <option
                                    key={destination.id}
                                    value={destination.id}
                                >
                                    {destination.name}
                                </option>
                            ))}
                        </select>

                        <label htmlFor="staff-member">
                            Resort Staff
                        </label>
                        <select
                            id="staff-member"
                            value={selectedStaffId}
                            onChange={(event) =>
                                setSelectedStaffId(event.target.value)
                            }
                            disabled={!selectedDestinationId}
                        >
                            <option value="">Select a staff member</option>
                            {availableStaff.map((staff) => (
                                <option
                                    key={staff.user_id}
                                    value={staff.user_id}
                                >
                                    {staff.email || "Resort Staff"}
                                </option>
                            ))}
                        </select>

                        {selectedDestinationId &&
                            availableStaff.length === 0 && (
                                <p className="admin-messages__no-staff">
                                    No active staff members are assigned to
                                    this resort.
                                </p>
                            )}

                        <label htmlFor="staff-subject">
                            Subject
                        </label>
                        <input
                            id="staff-subject"
                            value={newSubject}
                            onChange={(event) =>
                                setNewSubject(event.target.value)
                            }
                            maxLength={150}
                            placeholder="Staff Discussion"
                        />

                        <div className="admin-messages__modal-actions">
                            <button
                                type="button"
                                className="admin-messages__cancel"
                                disabled={creatingConversation}
                                onClick={() =>
                                    setShowNewConversation(false)
                                }
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="admin-messages__create"
                                disabled={
                                    !selectedDestinationId ||
                                    !selectedStaffId ||
                                    creatingConversation
                                }
                                onClick={() =>
                                    void createStaffConversation()
                                }
                            >
                                {creatingConversation
                                    ? "Creating..."
                                    : "Start Conversation"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
