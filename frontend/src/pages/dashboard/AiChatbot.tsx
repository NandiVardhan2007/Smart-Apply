import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Loader2, Trash2, MessageSquare } from 'lucide-react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "Hi there! I'm your AI career advisor. How can I help you today? I can review cover letters, give career advice, or help you prepare for an interview.",
};

const QUICK_PROMPTS = [
  "Write a cover letter for a Frontend Developer role",
  "How should I answer 'What is your greatest weakness?'",
  "Help me negotiate my salary",
  "What skills should I learn for AI engineering?"
];

export default function AiChatbot() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await apiFetch<{ reply: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: newMessages }),
      });

      if (res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: "I'm sorry, I encountered an error. Please try again." }
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Network error. Please check your connection." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 6rem)', maxWidth: 1000, margin: '0 auto', padding: 24, animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
            AI Chatbot.
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 16, marginTop: 4 }}>
            Get personalized guidance for your job search
          </p>
        </div>
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={() => setMessages([INITIAL_MESSAGE])}
          title="Clear Chat"
        >
          <Trash2 size={16} />
          <span>Clear</span>
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', border: '4px solid #000', boxShadow: '8px 8px 0px #000', overflow: 'hidden', position: 'relative' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              return (
                <motion.div
                  key={i}
                  style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', maxWidth: '80%' }}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 8px' }}>
                    {isUser ? (
                      <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>{(user?.full_name || '').split(' ')[0] || 'You'}</span>
                    ) : (
                      <>
                        <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                        <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>AI Advisor</span>
                      </>
                    )}
                  </div>
                  <div 
                    style={{ 
                      padding: '16px 20px', 
                      background: isUser ? 'var(--accent)' : '#f4f4f0', 
                      border: '3px solid #000', 
                      boxShadow: '4px 4px 0px #000',
                      borderRadius: 0,
                      color: '#000',
                      fontSize: 15,
                      fontWeight: 600,
                      lineHeight: 1.6
                    }}
                  >
                    {isUser ? (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    ) : (
                      <div className="markdown-content">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {isLoading && (
              <motion.div
                style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 8px' }}>
                  <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>AI Advisor</span>
                </div>
                <div style={{ background: '#f4f4f0', border: '3px solid #000', boxShadow: '4px 4px 0px #000', padding: '16px 20px', display: 'flex', gap: 6 }}>
                  <div style={{ width: 8, height: 8, background: '#000', borderRadius: '50%', animation: 'bounce 1s infinite' }} />
                  <div style={{ width: 8, height: 8, background: '#000', borderRadius: '50%', animation: 'bounce 1s infinite 0.2s' }} />
                  <div style={{ width: 8, height: 8, background: '#000', borderRadius: '50%', animation: 'bounce 1s infinite 0.4s' }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {messages.length === 1 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, pointerEvents: 'none' }}>
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                style={{
                  background: '#fff',
                  border: '3px solid #000',
                  boxShadow: '4px 4px 0px #000',
                  padding: 16,
                  textAlign: 'left',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  transition: 'all 0.1s',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-pink)';
                  e.currentTarget.style.transform = 'translate(-2px, -2px)';
                  e.currentTarget.style.boxShadow = '6px 6px 0px #000';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.transform = 'translate(0px, 0px)';
                  e.currentTarget.style.boxShadow = '4px 4px 0px #000';
                }}
              >
                <MessageSquare size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{prompt}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ padding: 24, background: '#f4f4f0', borderTop: '4px solid #000' }}>
          <form
            style={{ display: 'flex', gap: 16 }}
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
          >
            <input
              type="text"
              className="input-field"
              placeholder="ASK ME ANYTHING..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              style={{ flex: 1, padding: 16, fontSize: 16 }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!input.trim() || isLoading}
              style={{ width: 56, height: 56, padding: 0 }}
            >
              {isLoading ? <Loader2 size={24} className="spin" /> : <Send size={24} />}
            </button>
          </form>
        </div>
      </div>
      <style>{`
        @keyframes bounce { 
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .markdown-content p { margin-bottom: 0.5rem; }
        .markdown-content p:last-child { margin-bottom: 0; }
        .markdown-content ul { list-style-type: disc; margin-left: 1.5rem; margin-bottom: 0.5rem; }
        .markdown-content strong { font-weight: 900; }
      `}</style>
    </div>
  );
}
