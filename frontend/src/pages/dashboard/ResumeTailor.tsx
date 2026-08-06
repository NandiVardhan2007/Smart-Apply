import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Code2, Layout, PenSquare, Play, Download, ArrowLeft, ZoomIn, ZoomOut } from 'lucide-react';

import { apiFetch, getApiBaseUrl } from '../../api/client';
import { useToast } from '../../components/Toast';
import { PageLoader, ButtonSpinner } from '../../components/LoadingSpinner';

type Mode = 'latex' | 'html' | 'visual' | null;

const ENGINE_OPTIONS: {
  mode: Exclude<Mode, null>;
  icon: typeof Code2;
  title: string;
  description: string;
  cta: string;
}[] = [
  {
    mode: 'latex',
    icon: Code2,
    title: 'LaTeX engine',
    description:
      'Extracts your resume into raw LaTeX. Pixel-perfect precision and professional typesetting — best for exact replication and complex multi-column layouts.',
    cta: 'Use LaTeX',
  },
  {
    mode: 'html',
    icon: Layout,
    title: 'HTML / CSS engine',
    description:
      'Extracts your resume into modern HTML and CSS with an instant live preview as you type. Best for quick structural edits.',
    cta: 'Use HTML',
  },
  {
    mode: 'visual',
    icon: PenSquare,
    title: 'Visual editor',
    description:
      'A WYSIWYG experience — click any text in the preview and type to change it instantly. Best for non-technical edits.',
    cta: 'Use visual editor',
  },
];

/** Injects a tiny floating format toolbar (bold/italic/underline/link) into the
 * visual-editor iframe, positioned above whatever text the user has selected. */
function buildVisualDoc(htmlCode: string, zoom: number): string {
  const withEditable = htmlCode.replace(
    /<div class="resume-page">/,
    '<div class="resume-page" contenteditable="true" style="outline: 2px dashed #3452f4; outline-offset: 4px;">'
  );

  const withToolbar = withEditable.replace(
    '</body>',
    `
<style>
  .sa-floating-toolbar {
    position: absolute; background: #fff; border: 1px solid #d4d6dc; box-shadow: 0 4px 16px rgba(20,22,28,0.12);
    padding: 4px; border-radius: 8px; display: none; gap: 4px; z-index: 9999;
  }
  .sa-toolbar-btn {
    background: #fff; border: none; cursor: pointer; font-weight: 700; font-family: monospace;
    font-size: 13px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 4px;
  }
  .sa-toolbar-btn:hover { background: #f3f4f6; }
  @media print { .resume-page { outline: none !important; } .sa-floating-toolbar { display: none !important; } }
</style>
<div id="sa-toolbar" class="sa-floating-toolbar" contenteditable="false">
  <button class="sa-toolbar-btn" onclick="document.execCommand('bold', false, null)" title="Bold">B</button>
  <button class="sa-toolbar-btn" onclick="document.execCommand('italic', false, null)" title="Italic" style="font-style: italic;">I</button>
  <button class="sa-toolbar-btn" onclick="document.execCommand('underline', false, null)" title="Underline" style="text-decoration: underline;">U</button>
  <button class="sa-toolbar-btn" onclick="const url = prompt('Enter link URL:'); if(url) document.execCommand('createLink', false, url);" title="Link">&#128279;</button>
</div>
<script>
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    const toolbar = document.getElementById('sa-toolbar');
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      toolbar.style.display = 'flex';
      toolbar.style.top = (rect.top + window.scrollY - 42) + 'px';
      toolbar.style.left = (rect.left + window.scrollX + rect.width / 2 - toolbar.offsetWidth / 2) + 'px';
    } else {
      toolbar.style.display = 'none';
    }
  });
</script>
</body>`
  );

  return withToolbar.replace('</head>', `<style>body { zoom: ${zoom}; }</style></head>`);
}

export default function ResumeTailor() {
  const { id: rawId } = useParams();
  const id = rawId ? atob(rawId) : undefined;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [mode, setMode] = useState<Mode>(null);
  const [latexCode, setLatexCode] = useState('');
  const [htmlCode, setHtmlCode] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingLatex, setLoadingLatex] = useState(false);
  const [loadingHtml, setLoadingHtml] = useState(false);
  const [latexFetched, setLatexFetched] = useState(false);
  const [htmlFetched, setHtmlFetched] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const handleCompile = async (codeToCompile: string = latexCode) => {
    if (!codeToCompile.trim()) return;
    setCompiling(true);
    setCompileError(null);
    const baseUrl = getApiBaseUrl('/tailor/compile');
    try {
      const res = await fetch(`${baseUrl}/tailor/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sa_token')}`,
        },
        body: JSON.stringify({ latex_code: codeToCompile }),
      });

      if (res.ok) {
        const blob = await res.blob();
        setPdfUrl(URL.createObjectURL(blob));
      } else {
        try {
          const err = await res.json();
          setCompileError(err.detail || 'Compilation failed. Please check your LaTeX syntax.');
        } catch {
          setCompileError('Compilation failed with a server error.');
        }
      }
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : 'Network error occurred while compiling.');
    } finally {
      setCompiling(false);
    }
  };

  useEffect(() => {
    if (mode === 'latex' && !latexFetched && !loadingLatex) {
      (async () => {
        setLoadingLatex(true);
        try {
          const res = await apiFetch<{ latex_code: string }>('/tailor/extract-latex', {
            method: 'POST',
            body: JSON.stringify({ resume_id: id }),
          });
          if (res.ok) {
            setLatexCode(res.data.latex_code);
            setLatexFetched(true);
            showToast('success', 'LaTeX code loaded.');
            handleCompile(res.data.latex_code);
          } else {
            showToast('error', 'Failed to load LaTeX.');
          }
        } catch {
          showToast('error', 'Network error.');
        } finally {
          setLoadingLatex(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id, latexFetched, loadingLatex]);

  useEffect(() => {
    if ((mode === 'html' || mode === 'visual') && !htmlFetched && !loadingHtml) {
      (async () => {
        setLoadingHtml(true);
        try {
          const res = await apiFetch<{ html_code: string }>('/tailor/extract-html', {
            method: 'POST',
            body: JSON.stringify({ resume_id: id }),
          });
          if (res.ok) {
            setHtmlCode(res.data.html_code);
            setHtmlFetched(true);
            showToast('success', 'HTML code loaded.');
          } else {
            showToast('error', 'Failed to load HTML.');
          }
        } catch {
          showToast('error', 'Network error fetching HTML.');
        } finally {
          setLoadingHtml(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id, htmlFetched, loadingHtml]);

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
  const loadingText =
    mode === 'latex' ? 'Extracting LaTeX with NVIDIA vision…' : 'Extracting HTML with NVIDIA vision…';

  if (mode === null) {
    return (
      <div className="container-narrow">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/resumes')} style={{ marginBottom: 28 }}>
          <ArrowLeft size={15} /> Back to resumes
        </button>
        <h1 style={{ fontSize: 26, marginBottom: 8 }}>Choose your tailoring engine</h1>
        <p className="text-muted" style={{ marginBottom: 32, fontSize: 14.5 }}>
          Pick how you'd like to extract and edit this resume.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          {ENGINE_OPTIONS.map((opt) => (
            <div
              key={opt.mode}
              className="card card-interactive"
              onClick={() => setMode(opt.mode)}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius)',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <opt.icon size={22} />
              </div>
              <h3 style={{ fontSize: 16.5 }}>{opt.title}</h3>
              <p className="text-muted" style={{ fontSize: 13.5, lineHeight: 1.55, flex: 1 }}>
                {opt.description}
              </p>
              <button className="btn btn-primary btn-block">{opt.cta}</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageLoader show={isLoading} title={loadingText} subtitle="This can take up to 30 seconds." />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '80vh',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: 'var(--surface)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/resumes')}>
              <ArrowLeft size={15} /> Back
            </button>

            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {(['latex', 'html', 'visual'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="btn-sm"
                  style={{
                    padding: '7px 14px',
                    background: mode === m ? 'var(--accent)' : 'transparent',
                    color: mode === m ? 'var(--accent-ink)' : 'var(--ink)',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {m === 'latex' ? 'LaTeX' : m === 'html' ? 'HTML / CSS' : 'Visual'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {mode === 'latex' && (
              <button className="btn btn-primary btn-sm" onClick={() => handleCompile(latexCode)} disabled={compiling}>
                {compiling ? <ButtonSpinner size={14} /> : <Play size={14} />}
                Compile PDF
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={handleDownload} disabled={mode === 'latex' && !pdfUrl}>
              <Download size={14} /> Download
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {mode !== 'visual' && (
            <div style={{ flex: 1, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
              <textarea
                value={mode === 'latex' ? latexCode : htmlCode}
                onChange={(e) => (mode === 'latex' ? setLatexCode(e.target.value) : setHtmlCode(e.target.value))}
                style={{
                  flex: 1,
                  width: '100%',
                  padding: 16,
                  background: '#1a1c22',
                  color: '#d6d8de',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13.5,
                  border: 'none',
                  resize: 'none',
                  outline: 'none',
                }}
                spellCheck={false}
              />
            </div>
          )}

          <div style={{ flex: 1, background: 'var(--surface-sunken)', display: 'flex', flexDirection: 'column' }}>
            {mode === 'latex' ? (
              compileError ? (
                <div style={{ flex: 1, padding: 24, overflow: 'auto', background: '#1a1c22', color: '#f2685d' }}>
                  <h3 style={{ marginTop: 0, fontSize: 15, color: '#f2685d' }}>Compilation error</h3>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
                    {compileError}
                  </pre>
                </div>
              ) : pdfUrl ? (
                <iframe src={pdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF preview" />
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>
                  <FileText size={16} style={{ marginRight: 8 }} /> Click "Compile PDF" to generate a preview
                </div>
              )
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    padding: '8px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--surface)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {mode === 'visual' ? (
                    <span className="text-muted" style={{ fontSize: 13 }}>
                      <strong style={{ color: 'var(--ink)' }}>Visual mode:</strong> click any text to edit. Ctrl+scroll to zoom.
                    </span>
                  ) : (
                    <span />
                  )}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))} aria-label="Zoom out">
                      <ZoomOut size={14} />
                    </button>
                    <span className="font-mono" style={{ fontSize: 12.5, minWidth: 46, textAlign: 'center' }}>
                      {Math.round(zoom * 100)}%
                    </span>
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} aria-label="Zoom in">
                      <ZoomIn size={14} />
                    </button>
                  </div>
                </div>
                <div
                  style={{ flex: 1, overflow: 'auto' }}
                  onWheel={(e) => {
                    if (e.ctrlKey) {
                      e.preventDefault();
                      setZoom((z) => Math.min(Math.max(0.2, z - e.deltaY * 0.001), 3));
                    }
                  }}
                >
                  <iframe
                    ref={iframeRef}
                    sandbox="allow-scripts"
                    srcDoc={mode === 'visual' ? buildVisualDoc(htmlCode, zoom) : htmlCode.replace('</head>', `<style>body { zoom: ${zoom}; }</style></head>`)}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="HTML preview"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
