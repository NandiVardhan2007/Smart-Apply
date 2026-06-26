import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Play, Download, Loader2, ArrowLeft, Code, Layout, ZoomIn, ZoomOut, Edit3 } from 'lucide-react';
import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';

export default function ResumeTailor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [mode, setMode] = useState<'latex' | 'html' | 'visual' | null>(null);
  
  const [latexCode, setLatexCode] = useState('');
  const [htmlCode, setHtmlCode] = useState('');
  
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingLatex, setLoadingLatex] = useState(false);
  const [loadingHtml, setLoadingHtml] = useState(false);
  const [latexFetched, setLatexFetched] = useState(false);
  const [htmlFetched, setHtmlFetched] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (mode === 'latex' && !latexFetched && !loadingLatex) {
      const fetchOrExtractLatex = async () => {
        setLoadingLatex(true);
        try {
          const res = await apiFetch<{ latex_code: string }>(`/tailor/extract-latex`, {
            method: 'POST',
            body: JSON.stringify({ resume_id: id }),
          });
          if (res.ok && res.data) {
            setLatexCode(res.data.latex_code);
            setLatexFetched(true);
            showToast('success', 'LaTeX code loaded');
            handleCompile(res.data.latex_code);
          } else {
            showToast('error', 'Failed to load LaTeX');
          }
        } catch (err) {
          showToast('error', 'Network error');
        } finally {
          setLoadingLatex(false);
        }
      };
      fetchOrExtractLatex();
    }
  }, [mode, id, latexFetched, loadingLatex]);

  useEffect(() => {
    if ((mode === 'html' || mode === 'visual') && !htmlFetched && !loadingHtml) {
      const fetchOrExtractHtml = async () => {
        setLoadingHtml(true);
        try {
          const res = await apiFetch<{ html_code: string }>(`/tailor/extract-html`, {
            method: 'POST',
            body: JSON.stringify({ resume_id: id }),
          });
          if (res.ok && res.data) {
            setHtmlCode(res.data.html_code);
            setHtmlFetched(true);
            showToast('success', 'HTML code loaded');
          } else {
            showToast('error', 'Failed to load HTML');
          }
        } catch (err) {
          showToast('error', 'Network error fetching HTML');
        } finally {
          setLoadingHtml(false);
        }
      };
      fetchOrExtractHtml();
    }
  }, [mode, id, htmlFetched, loadingHtml]);

  const handleCompile = async (codeToCompile: string = latexCode) => {
    if (!codeToCompile.trim()) return;
    setCompiling(true);
    try {
      const res = await fetch(`/api/tailor/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sa_token')}`
        },
        body: JSON.stringify({ latex_code: codeToCompile })
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } else {
        const err = await res.json();
        showToast('error', err.detail || 'Compilation failed');
      }
    } catch (err) {
      showToast('error', 'Failed to compile');
    } finally {
      setCompiling(false);
    }
  };

  const handleDownload = () => {
    if (mode === 'latex' && pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = 'tailored_resume.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if ((mode === 'html' || mode === 'visual') && iframeRef.current) {
      iframeRef.current.contentWindow?.print();
    }
  };

  const isLoading = mode === 'latex' ? loadingLatex : loadingHtml;
  const loadingText = mode === 'latex' ? 'Extracting LaTeX using NVIDIA Vision...' : 'Extracting HTML using NVIDIA Vision...';

  if (mode === null) {
    return (
      <div style={{ padding: 40, maxWidth: 1000, margin: '0 auto' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/resumes')} style={{ marginBottom: 32 }}>
          <ArrowLeft size={16} /> Back to Resumes
        </button>
        <h1 style={{ fontSize: '2.5rem', marginBottom: 8, textShadow: '2px 2px 0 rgba(0,0,0,0.1)' }}>Select Tailoring Engine</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 40, fontSize: '1.1rem' }}>Choose how you want to extract and edit this resume.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
          <div 
            onClick={() => setMode('latex')}
            style={{ 
              background: '#fff', border: 'var(--border-brutal)', padding: 32, cursor: 'pointer',
              boxShadow: '8px 8px 0 #000', transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex', flexDirection: 'column', gap: 16
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translate(-4px, -4px)'; e.currentTarget.style.boxShadow = '12px 12px 0 #000'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '8px 8px 0 #000'; }}
          >
            <div style={{ width: 64, height: 64, background: 'var(--accent-start)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'var(--border-thin)' }}>
              <Code size={32} color="#000" />
            </div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>LaTeX Engine (Recommended)</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }}>
              Extracts your resume into raw LaTeX code. Offers pixel-perfect precision and professional typesetting. Best for exact replications and complex multi-column layouts.
            </p>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Use LaTeX</button>
          </div>

          <div 
            onClick={() => setMode('html')}
            style={{ 
              background: '#fff', border: 'var(--border-brutal)', padding: 32, cursor: 'pointer',
              boxShadow: '8px 8px 0 #000', transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex', flexDirection: 'column', gap: 16
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translate(-4px, -4px)'; e.currentTarget.style.boxShadow = '12px 12px 0 #000'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '8px 8px 0 #000'; }}
          >
            <div style={{ width: 64, height: 64, background: 'var(--accent-pink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'var(--border-thin)' }}>
              <Layout size={32} color="#000" />
            </div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>HTML/CSS Engine</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }}>
              Extracts your resume into modern HTML and CSS. Offers an instant live preview as you type and uses familiar web standards for styling. Best for quick structural edits.
            </p>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', background: 'var(--accent-pink)' }}>Use HTML</button>
          </div>

          <div 
            onClick={() => setMode('visual')}
            style={{ 
              background: '#fff', border: 'var(--border-brutal)', padding: 32, cursor: 'pointer',
              boxShadow: '8px 8px 0 #000', transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex', flexDirection: 'column', gap: 16
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translate(-4px, -4px)'; e.currentTarget.style.boxShadow = '12px 12px 0 #000'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '8px 8px 0 #000'; }}
          >
            <div style={{ width: 64, height: 64, background: 'var(--accent-yellow)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'var(--border-thin)' }}>
              <Edit3 size={32} color="#000" />
            </div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Visual Editor (Easiest)</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }}>
              Provides a What You See Is What You Get (WYSIWYG) editing experience. Simply click on the preview text and type to make changes instantly. Best for non-technical users.
            </p>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', background: 'var(--accent-yellow)' }}>Use Visual Editor</button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <Loader2 size={48} className="spin" style={{ color: 'var(--accent-start)' }} />
        <h3 style={{ fontSize: 20 }}>{loadingText}</h3>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '80vh', border: 'var(--border-brutal)', boxShadow: '8px 8px 0px #000', background: 'var(--bg-surface)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/resumes')}>
            <ArrowLeft size={16} /> Back
          </button>
          
          <div style={{ display: 'flex', background: 'var(--bg-body)', border: 'var(--border-brutal)', borderRadius: 4, overflow: 'hidden' }}>
            <button 
              onClick={() => setMode('latex')}
              style={{ padding: '8px 16px', background: mode === 'latex' ? 'var(--accent-start)' : 'transparent', color: mode === 'latex' ? '#000' : 'inherit', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Code size={16} /> LaTeX
            </button>
            <button 
              onClick={() => setMode('html')}
              style={{ padding: '8px 16px', background: mode === 'html' ? 'var(--accent-pink)' : 'transparent', color: mode === 'html' ? '#000' : 'inherit', border: 'none', borderLeft: 'var(--border-brutal)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Layout size={16} /> HTML / CSS
            </button>
            <button 
              onClick={() => setMode('visual')}
              style={{ padding: '8px 16px', background: mode === 'visual' ? 'var(--accent-yellow)' : 'transparent', color: mode === 'visual' ? '#000' : 'inherit', border: 'none', borderLeft: 'var(--border-brutal)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Edit3 size={16} /> Visual Editor
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {mode === 'latex' && (
            <button className="btn btn-primary" onClick={() => handleCompile(latexCode)} disabled={compiling}>
              {compiling ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
              Compile PDF
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleDownload} disabled={mode === 'latex' && !pdfUrl}>
            <Download size={16} />
            Download PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Editor Pane (Hidden in Visual Mode) */}
        {mode !== 'visual' && (
          <div style={{ flex: 1, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            {mode === 'latex' ? (
              <textarea
                value={latexCode}
                onChange={(e) => setLatexCode(e.target.value)}
                style={{
                  flex: 1, width: '100%', padding: 16, background: '#1e1e1e', color: '#d4d4d4',
                  fontFamily: 'monospace', fontSize: 14, border: 'none', resize: 'none', outline: 'none',
                }}
                spellCheck={false}
              />
            ) : (
              <textarea
                value={htmlCode}
                onChange={(e) => setHtmlCode(e.target.value)}
                style={{
                  flex: 1, width: '100%', padding: 16, background: '#1e1e1e', color: '#d4d4d4',
                  fontFamily: 'monospace', fontSize: 14, border: 'none', resize: 'none', outline: 'none',
                }}
                spellCheck={false}
              />
            )}
          </div>
        )}

        {/* Preview Pane */}
        <div style={{ flex: 1, background: 'var(--bg-body)', display: 'flex', flexDirection: 'column' }}>
          {mode === 'latex' ? (
            pdfUrl ? (
              <iframe src={pdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />
            ) : (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                Click "Compile PDF" to generate preview
              </div>
            )
          ) : (
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#f0f0f0', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderBottom: '1px solid var(--border-color)' }}>
                {mode === 'visual' ? (
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}><b>Visual Mode:</b> Click any text below to edit directly. Ctrl+Scroll to zoom.</span>
                ) : (
                  <span />
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}>
                    <ZoomOut size={16} />
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', fontFamily: 'monospace', minWidth: 60, justifyContent: 'center' }}>
                    {Math.round(zoom * 100)}%
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setZoom(z => Math.min(3, z + 0.1))}>
                    <ZoomIn size={16} />
                  </button>
                </div>
              </div>
              <div 
                style={{ flex: 1, overflow: 'auto' }}
                onWheel={(e) => {
                  if (e.ctrlKey) {
                    e.preventDefault();
                    setZoom(z => Math.min(Math.max(0.2, z - e.deltaY * 0.001), 3));
                  }
                }}
              >
                <div style={{ width: '100%', height: '100%' }}>
                  <iframe 
                    ref={iframeRef}
                    srcDoc={(mode === 'visual' ? htmlCode.replace(/<div class="resume-page">/, '<div class="resume-page" contenteditable="true" style="outline: 2px dashed #000; outline-offset: 4px;">').replace('</body>', `
<style>
  .sa-floating-toolbar {
    position: absolute;
    background: #fff;
    border: 2px solid #000;
    box-shadow: 4px 4px 0 #000;
    padding: 4px;
    border-radius: 4px;
    display: none;
    gap: 4px;
    z-index: 9999;
  }
  .sa-toolbar-btn {
    background: #fff;
    border: 2px solid transparent;
    cursor: pointer;
    font-weight: bold;
    font-family: monospace;
    font-size: 14px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
  }
  .sa-toolbar-btn:hover {
    background: #f0f0f0;
    border: 2px solid #000;
  }
  @media print {
    .resume-page { outline: none !important; }
    .sa-floating-toolbar { display: none !important; }
  }
</style>
<div id="sa-toolbar" class="sa-floating-toolbar" contenteditable="false">
  <button class="sa-toolbar-btn" onclick="document.execCommand('bold', false, null)" title="Bold">B</button>
  <button class="sa-toolbar-btn" onclick="document.execCommand('italic', false, null)" title="Italic" style="font-style: italic;">I</button>
  <button class="sa-toolbar-btn" onclick="document.execCommand('underline', false, null)" title="Underline" style="text-decoration: underline;">U</button>
  <button class="sa-toolbar-btn" onclick="const url = prompt('Enter link URL:'); if(url) document.execCommand('createLink', false, url);" title="Link">🔗</button>
</div>
<script>
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    const toolbar = document.getElementById('sa-toolbar');
    
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      toolbar.style.display = 'flex';
      toolbar.style.top = (rect.top + window.scrollY - 45) + 'px';
      toolbar.style.left = (rect.left + window.scrollX + rect.width / 2 - toolbar.offsetWidth / 2) + 'px';
    } else {
      toolbar.style.display = 'none';
    }
  });
</script>
</body>`) : htmlCode).replace('</head>', `<style>body { zoom: ${zoom}; }</style></head>`)}
                    style={{ width: '100%', height: '100%', border: 'none' }} 
                    title="HTML Preview" 
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
