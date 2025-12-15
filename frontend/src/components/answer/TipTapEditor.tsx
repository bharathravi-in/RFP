import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { useEffect } from 'react';
import clsx from 'clsx';
import {
    BoldIcon,
    ItalicIcon,
    UnderlineIcon,
    ListBulletIcon,
    LinkIcon,
    ArrowUturnLeftIcon,
    ArrowUturnRightIcon,
} from '@heroicons/react/24/outline';

interface TipTapEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
    editable?: boolean;
    className?: string;
}

export default function TipTapEditor({
    content,
    onChange,
    placeholder = 'Start typing your answer...',
    editable = true,
    className,
}: TipTapEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [2, 3],
                },
            }),
            Placeholder.configure({
                placeholder,
            }),
            Highlight.configure({
                multicolor: true,
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary underline cursor-pointer',
                },
            }),
        ],
        content,
        editable,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Update content when prop changes
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    // Update editable state
    useEffect(() => {
        if (editor) {
            editor.setEditable(editable);
        }
    }, [editable, editor]);

    if (!editor) {
        return (
            <div className="animate-pulse bg-background rounded-lg h-40" />
        );
    }

    return (
        <div className={clsx('tiptap-editor', className)}>
            {/* Toolbar */}
            {editable && (
                <div className="flex items-center gap-1 p-2 border-b border-border bg-background rounded-t-lg">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive('bold')}
                        title="Bold (Ctrl+B)"
                    >
                        <BoldIcon className="h-4 w-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive('italic')}
                        title="Italic (Ctrl+I)"
                    >
                        <ItalicIcon className="h-4 w-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        isActive={editor.isActive('underline')}
                        title="Underline (Ctrl+U)"
                    >
                        <UnderlineIcon className="h-4 w-4" />
                    </ToolbarButton>

                    <div className="w-px h-5 bg-border mx-1" />

                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive('bulletList')}
                        title="Bullet List"
                    >
                        <ListBulletIcon className="h-4 w-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive('orderedList')}
                        title="Numbered List"
                    >
                        <span className="text-xs font-medium">1.</span>
                    </ToolbarButton>

                    <div className="w-px h-5 bg-border mx-1" />

                    <ToolbarButton
                        onClick={() => {
                            const url = window.prompt('Enter URL');
                            if (url) {
                                editor.chain().focus().setLink({ href: url }).run();
                            }
                        }}
                        isActive={editor.isActive('link')}
                        title="Add Link"
                    >
                        <LinkIcon className="h-4 w-4" />
                    </ToolbarButton>

                    <div className="flex-1" />

                    <ToolbarButton
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        title="Undo (Ctrl+Z)"
                    >
                        <ArrowUturnLeftIcon className="h-4 w-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        title="Redo (Ctrl+Y)"
                    >
                        <ArrowUturnRightIcon className="h-4 w-4" />
                    </ToolbarButton>
                </div>
            )}

            {/* Bubble Menu for quick formatting */}
            {editable && (
                <BubbleMenu
                    editor={editor}
                    tippyOptions={{ duration: 100 }}
                    className="flex items-center gap-1 bg-surface border border-border rounded-lg shadow-lg p-1"
                >
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive('bold')}
                        size="sm"
                    >
                        <BoldIcon className="h-3 w-3" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive('italic')}
                        size="sm"
                    >
                        <ItalicIcon className="h-3 w-3" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHighlight().run()}
                        isActive={editor.isActive('highlight')}
                        size="sm"
                    >
                        <span className="h-3 w-3 bg-yellow-300 rounded text-[8px] font-bold flex items-center justify-center">H</span>
                    </ToolbarButton>
                </BubbleMenu>
            )}

            {/* Editor Content */}
            <EditorContent
                editor={editor}
                className={clsx(
                    'prose prose-sm max-w-none',
                    'min-h-[200px] p-4',
                    editable && 'bg-surface border border-border rounded-b-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-primary',
                    !editable && 'bg-background'
                )}
            />

            <style>{`
        .tiptap-editor .ProseMirror {
          outline: none;
          min-height: 180px;
        }
        .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #94A3B8;
          pointer-events: none;
          height: 0;
        }
        .tiptap-editor .ProseMirror p {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }
        .tiptap-editor .ProseMirror ul,
        .tiptap-editor .ProseMirror ol {
          padding-left: 1.5rem;
        }
        .tiptap-editor .ProseMirror li {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
        }
        .tiptap-editor .ProseMirror mark {
          background-color: #FEF08A;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
        }
      `}</style>
        </div>
    );
}

// Toolbar Button Component
interface ToolbarButtonProps {
    onClick?: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title?: string;
    size?: 'sm' | 'md';
    children: React.ReactNode;
}

function ToolbarButton({
    onClick,
    isActive = false,
    disabled = false,
    title,
    size = 'md',
    children,
}: ToolbarButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={clsx(
                'flex items-center justify-center rounded transition-colors',
                size === 'sm' && 'p-1',
                size === 'md' && 'p-1.5',
                isActive && 'bg-primary-light text-primary',
                !isActive && !disabled && 'text-text-secondary hover:text-text-primary hover:bg-background',
                disabled && 'text-text-muted cursor-not-allowed'
            )}
        >
            {children}
        </button>
    );
}
