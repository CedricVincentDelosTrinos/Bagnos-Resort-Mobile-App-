
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";

import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Heading2,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    Undo2,
    Redo2,
} from "lucide-react";

import "./DescriptionEditor.css";

interface DescriptionEditorProps {
    value: string;
    onChange: (value: string) => void;
}

export default function DescriptionEditor({
    value,
    onChange,
}: DescriptionEditorProps) {
    const editor = useEditor({
        immediatelyRender: false,

        extensions: [
            StarterKit,
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
        ],

        content: value || "",

        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },

        editorProps: {
            attributes: {
                class: "description-editor__content",
                "aria-label": "Resort description",
            },
        },
    });

    useEffect(() => {
        if (!editor) return;

        const currentContent = editor.getHTML();
        const newContent = value || "";

        if (currentContent !== newContent) {
            editor.commands.setContent(newContent, {
                emitUpdate: false,
            });
        }
    }, [editor, value]);

    if (!editor) return null;

    const toolbarButtons = [
        {
            label: "Bold",
            icon: Bold,
            action: () => editor.chain().focus().toggleBold().run(),
            active: editor.isActive("bold"),
        },
        {
            label: "Italic",
            icon: Italic,
            action: () => editor.chain().focus().toggleItalic().run(),
            active: editor.isActive("italic"),
        },
        {
            label: "Heading",
            icon: Heading2,
            action: () =>
                editor.chain().focus().toggleHeading({ level: 2 }).run(),
            active: editor.isActive("heading", { level: 2 }),
        },
        {
            label: "Bulleted list",
            icon: List,
            action: () => editor.chain().focus().toggleBulletList().run(),
            active: editor.isActive("bulletList"),
        },
        {
            label: "Numbered list",
            icon: ListOrdered,
            action: () => editor.chain().focus().toggleOrderedList().run(),
            active: editor.isActive("orderedList"),
        },
    ];

    const alignmentButtons = [
        { label: "Align left", icon: AlignLeft, value: "left" },
        { label: "Align center", icon: AlignCenter, value: "center" },
        { label: "Align right", icon: AlignRight, value: "right" },
        { label: "Justify", icon: AlignJustify, value: "justify" },
    ];

    return (
        <div className="description-editor">
            <div className="description-editor__toolbar">
                <div className="description-editor__toolbar-group">
                    {toolbarButtons.map(({ label, icon: Icon, action, active }) => (
                        <button
                            key={label}
                            type="button"
                            title={label}
                            aria-label={label}
                            className={active ? "active" : ""}
                            onClick={action}
                        >
                            <Icon size={17} />
                        </button>
                    ))}
                </div>

                <div className="description-editor__toolbar-group">
                    {alignmentButtons.map(({ label, icon: Icon, value }) => (
                        <button
                            key={value}
                            type="button"
                            title={label}
                            aria-label={label}
                            className={
                                editor.isActive({ textAlign: value }) ? "active" : ""
                            }
                            onClick={() =>
                                editor.chain().focus().setTextAlign(value).run()
                            }
                        >
                            <Icon size={17} />
                        </button>
                    ))}
                </div>

                <div className="description-editor__toolbar-group">
                    <button
                        type="button"
                        title="Undo"
                        aria-label="Undo"
                        disabled={!editor.can().undo()}
                        onClick={() => editor.chain().focus().undo().run()}
                    >
                        <Undo2 size={17} />
                    </button>

                    <button
                        type="button"
                        title="Redo"
                        aria-label="Redo"
                        disabled={!editor.can().redo()}
                        onClick={() => editor.chain().focus().redo().run()}
                    >
                        <Redo2 size={17} />
                    </button>
                </div>
            </div>

            <EditorContent editor={editor} />
        </div>
    );
}
