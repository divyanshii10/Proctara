'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useEffect, useState, useMemo } from 'react';
import { Bold, Italic, Loader2 } from 'lucide-react';
import { io } from 'socket.io-client';

interface LiveDocEditorProps {
  sessionId: string;
  onEditorReady?: (editor: any) => void;
}

const WS_URL = process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') || 'ws://localhost:3001';

export default function LiveDocEditor({ sessionId, onEditorReady }: LiveDocEditorProps) {
  const [status, setStatus] = useState('connecting');

  // Set up Yjs document and provider
  const { ydoc, provider } = useMemo(() => {
    const ydoc = new Y.Doc();
    // Connect to our backend hocuspocus endpoint
    const provider = new HocuspocusProvider({
      url: `${WS_URL}/yjs`,
      name: sessionId,
      document: ydoc,
    });
    return { ydoc, provider };
  }, [sessionId]);

  useEffect(() => {
    provider.on('status', (data: { status: string }) => {
      setStatus(data.status);
    });

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Collaboration.configure({
        document: ydoc,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none min-h-[500px]',
      },
    },
    onCreate: ({ editor }) => {
      if (onEditorReady) onEditorReady(editor);
    }
  });

  // Self-contained socket listener for pasting questions
  useEffect(() => {
    if (!editor) return;
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', { transports: ['websocket', 'polling'] });
    
    socket.on('interview:question', (data: { questionText: string; sequenceNum: number }) => {
      editor.commands.focus();
      editor.commands.insertContent(`<h2>Question ${data.sequenceNum || ''}</h2><p>${data.questionText}</p><p></p>`);
    });

    return () => {
      socket.disconnect();
    };
  }, [editor]);

  if (!editor) {
    return (
      <div className="flex justify-center items-center h-full text-zinc-400">
        <Loader2 className="animate-spin w-8 h-8 mr-3" /> Loading Editor...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#111111] text-zinc-200 rounded-lg shadow-xl overflow-hidden border border-zinc-800 font-sans">
      {/* Google Docs style toolbar */}
      <div className="flex items-center px-4 py-2 border-b border-zinc-800 bg-[#1a1a1a]">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors mr-1 ${editor.isActive('bold') ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}
        >
          <Bold size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${editor.isActive('italic') ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}
        >
          <Italic size={18} />
        </button>
        <div className="ml-auto text-xs text-zinc-500 flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${status === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          {status === 'connected' ? 'Synced' : 'Connecting...'}
        </div>
      </div>

      {/* Editor Content area */}
      <div className="flex-1 overflow-y-auto p-4 cursor-text" onClick={() => editor.commands.focus()}>
        <div className="max-w-4xl mx-auto h-full">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
