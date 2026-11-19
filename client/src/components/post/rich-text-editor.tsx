import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import {
  Bold,
  Italic,
  Heading2,
  List,
  Quote,
  Code,
  ImagePlus,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
}: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        bulletList: {},
        listItem: {},
        blockquote: {},
        codeBlock: {},
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Markdown,
    ],
    content: value,
    contentType: "markdown",
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getMarkdown());
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[500px] w-full rounded-lg bg-card p-6 text-[15px] leading-[1.8] outline-none focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
  
    console.log(
      "Registered extensions:",
      editor.extensionManager.extensions.map((ext) => ext.name)
    );
  
    console.log("Bullet list node:", !!editor.schema.nodes.bulletList);
    console.log("List item node:", !!editor.schema.nodes.listItem);
    console.log("Blockquote node:", !!editor.schema.nodes.blockquote);
  
    console.log(
      "Can toggle list:",
      editor.can().chain().toggleBulletList().run()
    );
  
    console.log(
      "Can toggle quote:",
      editor.can().chain().toggleBlockquote().run()
    );
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const currentMarkdown = editor.getMarkdown();

    if (value !== currentMarkdown) {
      editor.commands.setContent(value, {
        contentType: "markdown",
        emitUpdate: false,
      });
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const uploadInlineImage = useCallback(
    async (file: File) => {
      if (!editor) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file.");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be smaller than 5MB.");
        return;
      }

      const formData = new FormData();
      formData.append("image", file);

      setUploading(true);

      try {
        const response = await api.post(
          "/posts/inline-image",
          formData
        );

        const imageUrl = response.data.url;

        if (!imageUrl) {
          throw new Error("Image URL was not returned.");
        }

        editor
          .chain()
          .focus()
          .setImage({
            src: imageUrl,
            alt: file.name,
          })
          .run();

        toast.success("Image inserted successfully.");
      } catch (error: any) {
        console.error("Inline image upload failed:", error);
        toast.error(
          error?.response?.data?.error || "Image upload failed."
        );
      } finally {
        setUploading(false);

        if (imageInputRef.current) {
          imageInputRef.current.value = "";
        }
      }
    },
    [editor]
  );

  const tools = [
    {
      label: "Bold",
      icon: Bold,
      action: () => editor?.chain().focus().toggleBold().run(),
      active: editor?.isActive("bold"),
    },
    {
      label: "Italic",
      icon: Italic,
      action: () => editor?.chain().focus().toggleItalic().run(),
      active: editor?.isActive("italic"),
    },
    {
      label: "Heading",
      icon: Heading2,
      action: () =>
        editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor?.isActive("heading", { level: 2 }),
    },
    {
      label: "List",
      icon: List,
      action: () => editor?.chain().focus().toggleBulletList().run(),
      active: editor?.isActive("bulletList"),
    },
    {
      label: "Quote",
      icon: Quote,
      action: () => editor?.chain().focus().toggleBlockquote().run(),
      active: editor?.isActive("blockquote"),
    },
    {
      label: "Code",
      icon: Code,
      action: () => editor?.chain().focus().toggleCodeBlock().run(),
      active: editor?.isActive("codeBlock"),
    },
  ];

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
        {tools.map(({ label, icon: Icon, action, active }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            disabled={!editor || !!disabled}
            onMouseDown={(event) => {
              event.preventDefault();
              action();
            }}
            className={`grid h-9 w-9 place-items-center rounded-md transition-colors ${
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}

        <span className="mx-1 h-7 w-px bg-border" />

        <button
          type="button"
          title="Insert image"
          aria-label="Insert image"
          disabled={!editor || disabled || uploading}
          onClick={() => imageInputRef.current?.click()}
          className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" />
        </button>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadInlineImage(file);
          }}
        />

        {uploading && (
          <span className="ml-2 text-xs text-muted-foreground">
            Uploading image...
          </span>
        )}
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
