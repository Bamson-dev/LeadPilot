"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback, useState } from "react";

interface RichEmailEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const toolbarBtnStyle = (active: boolean) => ({
  background: active ? "rgba(124,58,237,0.2)" : "transparent",
  border: `1px solid ${active ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.08)"}`,
  borderRadius: 6,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 700,
  color: active ? "#A78BFA" : "#8888A8",
  cursor: "pointer",
  fontFamily: "Inter, sans-serif",
  lineHeight: 1,
  transition: "all 0.15s",
});

const separatorStyle = {
  width: 1,
  height: 20,
  background: "rgba(255,255,255,0.08)",
  margin: "0 4px",
  alignSelf: "center" as const,
};

export default function RichEmailEditor({
  value,
  onChange,
  placeholder = "Write your email here...",
}: RichEmailEditorProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          style: "color:#7C3AED;font-weight:600;text-decoration:underline;",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          style: "max-width:100%;border-radius:8px;margin:12px 0;",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        style: [
          "min-height:280px",
          "padding:16px",
          "outline:none",
          "font-size:14px",
          "line-height:1.7",
          "color:#F2F1FF",
          "font-family:Inter,sans-serif",
        ].join(";"),
      },
    },
  });

  useEffect(() => {
    if (editor && value === "") {
      editor.commands.clearContent();
    }
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!linkUrl) return;
    if (editor?.state.selection.empty) {
      editor
        ?.chain()
        .focus()
        .insertContent(
          `<a href="${linkUrl}" style="color:#7C3AED;font-weight:600;text-decoration:underline;">${linkUrl}</a>`
        )
        .run();
    } else {
      editor?.chain().focus().setLink({ href: linkUrl }).run();
    }
    setLinkUrl("");
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const addImage = useCallback(() => {
    if (!imageUrl) return;
    editor?.chain().focus().setImage({ src: imageUrl }).run();
    setImageUrl("");
    setShowImageInput(false);
  }, [editor, imageUrl]);

  if (!editor) return null;

  return (
    <div
      style={{
        background: "#0A0A10",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "#111118",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "8px 12px",
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          style={toolbarBtnStyle(editor.isActive("bold"))}
          title="Bold"
        >
          <strong>B</strong>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          style={toolbarBtnStyle(editor.isActive("italic"))}
          title="Italic"
        >
          <em>I</em>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          style={toolbarBtnStyle(editor.isActive("underline"))}
          title="Underline"
        >
          <u>U</u>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          style={toolbarBtnStyle(editor.isActive("strike"))}
          title="Strikethrough"
        >
          <s>S</s>
        </button>

        <div style={separatorStyle} />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          style={toolbarBtnStyle(editor.isActive("heading", { level: 1 }))}
          title="Heading 1"
        >
          H1
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          style={toolbarBtnStyle(editor.isActive("heading", { level: 2 }))}
          title="Heading 2"
        >
          H2
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          style={toolbarBtnStyle(editor.isActive("heading", { level: 3 }))}
          title="Heading 3"
        >
          H3
        </button>

        <div style={separatorStyle} />

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          style={toolbarBtnStyle(editor.isActive({ textAlign: "left" }))}
          title="Align left"
        >
          ≡
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          style={toolbarBtnStyle(editor.isActive({ textAlign: "center" }))}
          title="Align center"
        >
          ≡
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          style={toolbarBtnStyle(editor.isActive({ textAlign: "right" }))}
          title="Align right"
        >
          ≡
        </button>

        <div style={separatorStyle} />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          style={toolbarBtnStyle(editor.isActive("bulletList"))}
          title="Bullet list"
        >
          • List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          style={toolbarBtnStyle(editor.isActive("orderedList"))}
          title="Numbered list"
        >
          1. List
        </button>

        <div style={separatorStyle} />

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#555570" }}>Color</span>
          <input
            type="color"
            defaultValue="#F2F1FF"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            style={{
              width: 28,
              height: 24,
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
              background: "none",
              padding: 0,
            }}
            title="Text color"
          />
        </div>

        <div style={separatorStyle} />

        <button
          type="button"
          onClick={() => {
            setShowLinkInput(!showLinkInput);
            setShowImageInput(false);
          }}
          style={toolbarBtnStyle(editor.isActive("link") || showLinkInput)}
          title="Insert link"
        >
          🔗 Link
        </button>

        <button
          type="button"
          onClick={() => {
            setShowImageInput(!showImageInput);
            setShowLinkInput(false);
          }}
          style={toolbarBtnStyle(showImageInput)}
          title="Insert image"
        >
          🖼 Image
        </button>

        <div style={separatorStyle} />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          style={toolbarBtnStyle(editor.isActive("blockquote"))}
          title="Blockquote"
        >
          &quot; Quote
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          style={toolbarBtnStyle(false)}
          title="Divider"
        >
          ― Line
        </button>

        <div style={separatorStyle} />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          style={toolbarBtnStyle(false)}
          title="Undo"
        >
          ↩
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          style={toolbarBtnStyle(false)}
          title="Redo"
        >
          ↪
        </button>
      </div>

      {showLinkInput && (
        <div
          style={{
            background: "#0F0F14",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            padding: "10px 12px",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "#8888A8", whiteSpace: "nowrap" }}>Link URL</span>
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setLink()}
            placeholder="https://leadthur.com"
            autoFocus
            style={{
              flex: 1,
              background: "#0A0A10",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
              color: "#F2F1FF",
              fontFamily: "Inter, sans-serif",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={setLink}
            style={{
              background: "#7C3AED",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().unsetLink().run();
              setShowLinkInput(false);
            }}
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#EF4444",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Remove
          </button>
        </div>
      )}

      {showImageInput && (
        <div
          style={{
            background: "#0F0F14",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            padding: "10px 12px",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "#8888A8", whiteSpace: "nowrap" }}>Image URL</span>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addImage()}
            placeholder="https://example.com/image.png"
            autoFocus
            style={{
              flex: 1,
              background: "#0A0A10",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
              color: "#F2F1FF",
              fontFamily: "Inter, sans-serif",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={addImage}
            style={{
              background: "#7C3AED",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Insert
          </button>
        </div>
      )}

      <div style={{ position: "relative" }}>
        <style>{`
          .tiptap-editor p { margin: 0 0 12px 0; }
          .tiptap-editor h1 { font-size: 24px; font-weight: 800; margin: 0 0 14px 0; color: #F2F1FF; }
          .tiptap-editor h2 { font-size: 20px; font-weight: 700; margin: 0 0 12px 0; color: #F2F1FF; }
          .tiptap-editor h3 { font-size: 16px; font-weight: 700; margin: 0 0 10px 0; color: #F2F1FF; }
          .tiptap-editor ul { padding-left: 20px; margin: 0 0 12px 0; }
          .tiptap-editor ol { padding-left: 20px; margin: 0 0 12px 0; }
          .tiptap-editor li { margin-bottom: 4px; color: #F2F1FF; }
          .tiptap-editor blockquote { border-left: 3px solid #7C3AED; padding-left: 14px; margin: 0 0 12px 0; color: #8888A8; font-style: italic; }
          .tiptap-editor hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 16px 0; }
          .tiptap-editor a { color: #7C3AED; font-weight: 600; text-decoration: underline; }
          .tiptap-editor img { max-width: 100%; border-radius: 8px; margin: 12px 0; display: block; }
          .tiptap-editor p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #555570; pointer-events: none; float: left; height: 0; }
          .tiptap-editor:focus { outline: none; }
        `}</style>
        <EditorContent editor={editor} className="tiptap-editor" />
      </div>
    </div>
  );
}
