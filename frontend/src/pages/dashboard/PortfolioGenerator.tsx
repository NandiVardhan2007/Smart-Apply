import { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Download, RefreshCw, Palette } from 'lucide-react';
import { InlineLoader } from '../../components/LoadingSpinner';
import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';

export default function PortfolioGenerator() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);

  // Form State
  const [theme, setTheme] = useState('Neo-Brutalism');
  const [customInstructions, setCustomInstructions] = useState('');

  const THEMES = [
    'Neo-Brutalism', 'Minimalist', 'Cyberpunk', 'Clean Professional', 
    'Retro 90s Web', 'Dark Mode Hacker', 'Glassmorphism', 'Y2K Aesthetic'
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setHtmlContent(null);
    try {
      const res = await apiFetch<{ html: string }>('/portfolio/generate', {
        method: 'POST',
        body: JSON.stringify({
          theme,
          custom_instructions: customInstructions,
        }),
      });

      if (res.ok && res.data) {
        setHtmlContent(res.data.html);
        showToast('success', 'Portfolio generated successfully!');
      } else {
        showToast('error', (res.data as any)?.detail || 'Failed to generate portfolio');
      }
    } catch {
      showToast('error', 'Network error while generating portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!htmlContent) return;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${user?.full_name?.replace(/\s+/g, '_') || 'My'}_Portfolio.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Globe size={40} /> 1-Click Portfolio
        </h1>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Turn your profile data into a fully coded, single-page website instantly.
        </p>
      </div>

      {!htmlContent && !loading ? (
        <div style={{ background: '#fff', border: '4px solid #000', boxShadow: '8px 8px 0px #000', padding: 32 }}>
          <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            <div className="input-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Palette size={20} /> Select a Theme
              </label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {THEMES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    style={{
                      padding: '12px 24px',
                      background: theme === t ? 'var(--accent)' : '#fff',
                      border: '2px solid #000',
                      fontWeight: 900,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      boxShadow: theme === t ? 'none' : '4px 4px 0px #000',
                      transform: theme === t ? 'translate(4px, 4px)' : 'none',
                      transition: 'all 0.1s'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label>Custom Instructions (Optional)</label>
              <textarea
                className="input-field"
                rows={4}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="E.g., Make sure to emphasize my React experience. Use purple as the primary color..."
              />
            </div>

            <div style={{ background: 'var(--bg-color)', padding: 16, border: '2px solid #000', fontWeight: 600 }}>
              <strong>Note:</strong> We will automatically include your Bio, LinkedIn, GitHub, and Education from your Profile.
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ fontSize: '1.2rem', padding: '16px', justifyContent: 'center' }}
            >
              GENERATE WEBSITE
            </button>
          </form>
        </div>
      ) : loading ? (
        <InlineLoader 
          variant="generate" 
          title="WRITING CODE..." 
          subtitle={`Designing your ${theme} portfolio...`} 
        />
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
        >
          <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontWeight: 900, textTransform: 'uppercase' }}>Preview</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setHtmlContent(null)} className="btn" style={{ background: '#fff' }}>
                <RefreshCw size={20} style={{ marginRight: 8 }} /> Try Another Theme
              </button>
              <button onClick={handleDownload} className="btn btn-primary">
                <Download size={20} style={{ marginRight: 8 }} /> Download HTML
              </button>
            </div>
          </div>

          <div style={{ 
            border: '4px solid #000', 
            boxShadow: '8px 8px 0px #000', 
            background: '#fff',
            height: '70vh',
            overflow: 'hidden',
            resize: 'vertical'
          }}>
            <iframe 
              srcDoc={htmlContent || ''} 
              title="Portfolio Preview"
              style={{ width: '100%', height: '100%', border: 'none' }}
              sandbox="allow-scripts"
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
