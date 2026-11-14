import { useEffect, useState } from "react";
import { MessageSquare, Plus, Send, ArrowLeft } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabase";

import "./ClientMessagesPage.css";

interface Conversation {
    id: string;
    destination_id: string | null;
    created_by: string;
    subject: string;
    created_at: string;
    updated_at: string;
    last_message_at: string;
    conversation_type: "client_admin" | "client_resort" | "admin_staff";
}

interface Destination {
    id: string;
    name: string;
}

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    message: string;
    created_at: string;
}

type ConversationAction =
    | { type: "admin" }
    | { type: "resort"; destinationId: string };

interface PendingConversationConfirmation {
    action: ConversationAction;
    oldestConversationId: string;
}

export default function ClientMessagesPage() {
    const { user } = useAuth();
    const currentUserId = user?.id;

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);

    const [selectedConversation, setSelectedConversation] =
        useState<Conversation | null>(null);

    const [messageText, setMessageText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");

    const [creatingConversation, setCreatingConversation] = useState(false);

    const [pendingConfirmation, setPendingConfirmation] =
        useState<PendingConversationConfirmation | null>(null);

    useEffect(() => {
        if (!user) return;

        async function loadInitialData() {
            setLoading(true);
            setError("");

            try {
                const { data: destinationData, error: destinationError } =
                    await supabase
                        .from("destinations")
                        .select("id, name")
                        .order("name");

                if (destinationError) throw destinationError;

                setDestinations(destinationData ?? []);

                const { data: participantData, error: participantError } =
                    await supabase
                        .from("conversation_participants")
                        .select("conversation_id")
                        .eq("user_id", user!.id);

                if (participantError) throw participantError;

                const conversationIds = (participantData ?? []).map(
                    (item) => item.conversation_id
                );

                if (conversationIds.length === 0) {
                    setConversations([]);
                    return;
                }

                const { data: conversationData, error: conversationError } =
                    await supabase
                        .from("conversations")
                        .select("*")
                        .in("id", conversationIds)
                        .order("last_message_at", { ascending: false });

                if (conversationError) throw conversationError;

                setConversations(conversationData ?? []);
            } catch (err) {
                console.error("Unable to load messages:", err);
                setError("Unable to load your conversations. Please try again.");
            } finally {
                setLoading(false);
            }
        }

        loadInitialData();
    }, [user]);


    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel(`client-inbox-deletions-${currentUserId}`)
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "conversations",
                },
                (payload) => {
                    const deleted = payload.old as { id?: string };
                    if (!deleted.id) return;

                    setConversations((current) =>
                        current.filter(
                            (conversation) => conversation.id !== deleted.id
                        )
                    );

                    setSelectedConversation((current) => {
                        if (current?.id !== deleted.id) return current;

                        setMessages([]);
                        setMessageText("");
                        setError(
                            "This conversation has expired or been deleted."
                        );

                        return null;
                    });
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "conversations",
                },
                (payload) => {
                    const updated = payload.new as Conversation;

                    setConversations((current) =>
                        current
                            .map((conversation) =>
                                conversation.id === updated.id
                                    ? updated
                                    : conversation
                            )
                            .sort(
                                (a, b) =>
                                    new Date(b.last_message_at).getTime() -
                                    new Date(a.last_message_at).getTime()
                            )
                    );


                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [currentUserId]);


    useEffect(() => {
        if (!currentUserId) return;

        function syncSelectedConversation(refreshed: Conversation[]) {
            if (
                selectedConversation &&
                !refreshed.some(
                    (conversation) => conversation.id === selectedConversation.id
                )
            ) {
                setSelectedConversation(null);
                setMessages([]);
                setMessageText("");
                setError("This conversation has expired or been deleted.");
            }
        }

        async function refreshOnReturn() {
            const { data: participants, error: participantError } =
                await supabase
                    .from("conversation_participants")
                    .select("conversation_id")
                    .eq("user_id", currentUserId);

            if (participantError) {
                console.error("Unable to refresh conversations:", participantError);
                return;
            }

            const ids = (participants ?? []).map(
                (item) => item.conversation_id
            );

            if (ids.length === 0) {
                setConversations([]);
                syncSelectedConversation([]);
                return;
            }

            const { data, error: conversationError } = await supabase
                .from("conversations")
                .select("*")
                .in("id", ids)
                .order("last_message_at", { ascending: false });

            if (conversationError) {
                console.error("Unable to refresh conversations:", conversationError);
                return;
            }

            const refreshed = data ?? [];
            setConversations(refreshed);
            syncSelectedConversation(refreshed);
        }

        function handleVisibilityChange() {
            if (document.visibilityState === "visible") {
                void refreshOnReturn();
            }
        }

        window.addEventListener("focus", refreshOnReturn);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("focus", refreshOnReturn);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [currentUserId, selectedConversation]);


    useEffect(() => {
        if (!selectedConversation) {
            setMessages([]);
            return;
        }

        let active = true;
        setMessages([]);
        setError("");

        async function loadMessages() {
            const { data, error: messageError } = await supabase
                .from("messages")
                .select("*")
                .eq("conversation_id", selectedConversation!.id)
                .order("created_at", { ascending: true });

            if (!active) return;

            if (messageError) {
                setError("Unable to load this conversation.");
                return;
            }

            setMessages((current) => {
                const combined = [...current, ...(data ?? [])];

                const unique = Array.from(
                    new Map(combined.map((message) => [message.id, message])).values()
                );

                return unique.sort(
                    (a, b) =>
                        new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime()
                );
            });

            await supabase
                .from("conversation_reads")
                .upsert(
                    {
                        conversation_id: selectedConversation!.id,
                        user_id: user!.id,
                        last_read_at: new Date().toISOString(),
                    },
                    { onConflict: "conversation_id,user_id" }
                );
        }

        const channel = supabase
            .channel(`client-messages-${selectedConversation.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `conversation_id=eq.${selectedConversation.id}`,
                },
                (payload) => {
                    const incoming = payload.new as Message;

                    setMessages((current) => {
                        if (current.some((item) => item.id === incoming.id)) {
                            return current;
                        }

                        return [...current, incoming];
                    });

                    if (incoming.sender_id !== user!.id) {
                        void supabase
                            .from("conversation_reads")
                            .upsert(
                                {
                                    conversation_id: selectedConversation!.id,
                                    user_id: user!.id,
                                    last_read_at: new Date().toISOString(),
                                },
                                { onConflict: "conversation_id,user_id" }
                            );
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
    }, [selectedConversation, user]);

    async function createConversation(
        action: ConversationAction,
        confirmDeleteConversationId: string | null = null
    ) {
        if (!user || creatingConversation) return;

        setCreatingConversation(true);
        setError("");

        try {
            const rpcName =
                action.type === "admin"
                    ? "create_client_admin_conversation"
                    : "create_client_resort_conversation";

            const rpcArgs =
                action.type === "admin"
                    ? {
                        p_client_user_id: user.id,
                        p_subject: "General inquiry",
                        p_confirm_delete_conversation_id:
                            confirmDeleteConversationId,
                    }
                    : {
                        p_client_user_id: user.id,
                        p_destination_id: action.destinationId,
                        p_subject: "Resort inquiry",
                        p_confirm_delete_conversation_id:
                            confirmDeleteConversationId,
                    };

            const { data, error: rpcError } = await supabase.rpc(
                rpcName,
                rpcArgs
            );

            if (rpcError) {
                const limitMatch = rpcError.message.match(
                    /CHAT_LIMIT_REACHED:([0-9a-f-]{36})/i
                );

                if (limitMatch && !confirmDeleteConversationId) {
                    setPendingConfirmation({
                        action,
                        oldestConversationId: limitMatch[1],
                    });
                    return;
                }

                if (rpcError.message.includes("CHAT_LIMIT_CHANGED")) {
                    setPendingConfirmation(null);

                    await refreshConversations();

                    setError(
                        "Your conversations have changed. Please review your inbox and try again."
                    );
                    return;
                }

                setError(rpcError.message);
                return;
            }

            if (!data) {
                setError("The conversation could not be created.");
                return;
            }

            setPendingConfirmation(null);

            await refreshConversations();
            await openConversation(data);
        } catch (err) {
            console.error("Unable to create conversation:", err);
            setError("Unable to start your conversation. Please try again.");
        } finally {
            setCreatingConversation(false);
        }
    }

    function startAdminConversation() {
        void createConversation({ type: "admin" });
    }

    function startResortConversation(destinationId: string) {
        void createConversation({
            type: "resort",
            destinationId,
        });
    }

    function confirmConversationDeletion() {
        if (!pendingConfirmation || creatingConversation) return;

        void createConversation(
            pendingConfirmation.action,
            pendingConfirmation.oldestConversationId
        );
    }

    async function refreshConversations() {
        if (!currentUserId) return;

        const { data: participants, error: participantError } = await supabase
            .from("conversation_participants")
            .select("conversation_id")
            .eq("user_id", currentUserId);

        if (participantError) {
            console.error("Unable to refresh participants:", participantError);
            setError("Unable to refresh your conversations.");
            return;
        }

        const ids = (participants ?? []).map((item) => item.conversation_id);

        if (ids.length === 0) {
            setConversations([]);
            return;
        }

        const { data, error: conversationError } = await supabase
            .from("conversations")
            .select("*")
            .in("id", ids)
            .order("last_message_at", { ascending: false });

        if (conversationError) {
            console.error("Unable to refresh conversations:", conversationError);
            setError("Unable to refresh your conversations.");
            return;
        }

        setConversations(data ?? []);
    }

    async function openConversation(conversationId: string) {
        const existing = conversations.find(
            (item) => item.id === conversationId
        );

        if (existing) {
            setSelectedConversation(existing);
            return;
        }

        const { data, error: conversationError } = await supabase
            .from("conversations")
            .select("*")
            .eq("id", conversationId)
            .single();

        if (conversationError || !data) {
            setError("Unable to open the conversation.");
            return;
        }

        setSelectedConversation(data);
    }

    async function sendMessage() {
        if (!user || !selectedConversation || !messageText.trim() || sending) {
            return;
        }

        setSending(true);
        setError("");

        const { error: sendError } = await supabase.from("messages").insert({
            conversation_id: selectedConversation.id,
            sender_id: user.id,
            message: messageText.trim(),
        });

        if (sendError) {
            setError(sendError.message);
        } else {
            setMessageText("");
        }

        setSending(false);
    }

    const destinationName = (destinationId: string | null) =>
        destinations.find((item) => item.id === destinationId)?.name ??
        "Resort";

    if (loading) {
        return <div className="client-messages-loading">Loading messages...</div>;
    }

    return (
        <section className="client-messages">
            <header className="client-messages__header">
                {selectedConversation ? (
                    <button
                        type="button"
                        onClick={() => setSelectedConversation(null)}
                        aria-label="Back to conversations"
                    >
                        <ArrowLeft size={20} />
                    </button>
                ) : (
                    <MessageSquare size={23} />
                )}

                <div>
                    <h1>
                        {selectedConversation
                            ? selectedConversation.conversation_type === "client_admin"
                                ? "Admin Team"
                                : destinationName(selectedConversation.destination_id)
                            : "Messages"}
                    </h1>
                    <p>
                        {selectedConversation
                            ? "Your conversation"
                            : "Contact the resort team"}
                    </p>
                </div>
            </header>

            {error && <p className="client-messages__error">{error}</p>}

            {!selectedConversation ? (
                <div className="client-messages__inbox">
                    <button
                        type="button"
                        className="client-messages__new"
                        onClick={startAdminConversation}
                    >
                        <Plus size={19} />
                        Contact Admin Team
                    </button>

                    <h2>Contact a Resort</h2>

                    {destinations.map((destination) => (
                        <button
                            key={destination.id}
                            type="button"
                            className="client-messages__resort"
                            onClick={() => startResortConversation(destination.id)}
                        >
                            <span>{destination.name}</span>
                            <MessageSquare size={18} />
                        </button>
                    ))}

                    <h2>Your Conversations</h2>

                    {conversations.length === 0 ? (
                        <p className="client-messages__empty">
                            You don't have any conversations yet.
                        </p>
                    ) : (
                        conversations.map((conversation) => (
                            <button
                                key={conversation.id}
                                type="button"
                                className="client-messages__conversation"
                                onClick={() => setSelectedConversation(conversation)}
                            >
                                <span>
                                    {conversation.conversation_type === "client_admin"
                                        ? "Admin Team"
                                        : destinationName(conversation.destination_id)}
                                </span>
                                <small>
                                    {new Date(
                                        conversation.last_message_at
                                    ).toLocaleDateString()}
                                </small>
                            </button>
                        ))
                    )}
                </div>
            ) : (
                <div className="client-messages__thread">
                    <div className="client-messages__history">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`client-message ${message.sender_id === user?.id
                                    ? "client-message--own"
                                    : "client-message--other"
                                    }`}
                            >
                                <p>{message.message}</p>
                                <small>
                                    {new Date(message.created_at).toLocaleTimeString(
                                        [],
                                        { hour: "2-digit", minute: "2-digit" }
                                    )}
                                </small>
                            </div>
                        ))}
                    </div>

                    <form
                        className="client-messages__composer"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void sendMessage();
                        }}
                    >
                        <input
                            value={messageText}
                            onChange={(event) => setMessageText(event.target.value)}
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
                </div>
            )}
            {pendingConfirmation && (
                <div
                    className="client-messages__modal-overlay"
                    role="presentation"
                >
                    <div
                        className="client-messages__modal"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="conversation-limit-title"
                        aria-describedby="conversation-limit-description"
                    >
                        <div className="client-messages__modal-icon">
                            <MessageSquare size={25} />
                        </div>

                        <h2 id="conversation-limit-title">
                            Conversation limit reached
                        </h2>

                        <p id="conversation-limit-description">
                            You already have 4 active conversations. To start
                            this new conversation, your oldest conversation
                            will be permanently deleted, including its messages.
                        </p>

                        <p className="client-messages__modal-warning">
                            This action cannot be undone. Do you want to continue?
                        </p>

                        <div className="client-messages__modal-actions">
                            <button
                                type="button"
                                className="client-messages__modal-cancel"
                                disabled={creatingConversation}
                                onClick={() => setPendingConfirmation(null)}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="client-messages__modal-confirm"
                                disabled={creatingConversation}
                                onClick={confirmConversationDeletion}
                            >
                                {creatingConversation
                                    ? "Please wait..."
                                    : "Continue"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}