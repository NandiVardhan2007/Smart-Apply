import { useState, useRef, useCallback } from 'react';
import { Loader2, Play, Send, Terminal, AlertTriangle } from 'lucide-react';
import Editor from '@monaco-editor/react';

import { apiFetch } from '../api/client';

/* ────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  execution_time: number | null;
  language: string;
  version: string;
}

export interface CodeExecutionPanelProps {
  /** Called when the user clicks "Submit to Interviewer" */
  onSubmit: (language: string, code: string, result: ExecutionResult | null) => void;
}

/* ────────────────────────────────────────────────────────────
 * Constants
 * ──────────────────────────────────────────────────────────── */

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python',     label: 'Python' },
  { value: 'java',       label: 'Java' },
  { value: 'cpp',        label: 'C++' },
] as const;

const STARTER_CODE: Record<string, string> = {
  javascript: '// Write your solution here\nconsole.log("Hello, World!");\n',
  typescript: '// Write your solution here\nconst greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("World"));\n',
  python:     '# Write your solution here\nprint("Hello, World!")\n',
  java:       'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
  cpp:        '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n',
};

/* ────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────── */

export default function CodeExecutionPanel({ onSubmit }: CodeExecutionPanelProps) {
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState(STARTER_CODE.javascript);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [outputTab, setOutputTab] = useState<'stdout' | 'stderr'>('stdout');
  const [error, setError] = useState<string | null>(null);

  // Track whether the user has manually edited code — used to decide if
  // switching languages should reset the editor to a starter template.
  const userEditedRef = useRef(false);

  const handleLanguageChange = useCallback((newLang: string) => {
    setLanguage(newLang);
    if (!userEditedRef.current) {
      setCode(STARTER_CODE[newLang] || '');
    }
    setResult(null);
    setError(null);
  }, []);

  const handleCodeChange = useCallback((val: string | undefined) => {
    const newCode = val || '';
    setCode(newCode);
    userEditedRef.current = true;
  }, []);

  /* ── Run code ── */
  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiFetch<ExecutionResult>('/code/execute', {
        method: 'POST',
        body: JSON.stringify({ language, code }),
      });

      if (res.ok) {
        setResult(res.data);
        setOutputTab(res.data.stderr ? 'stderr' : 'stdout');
      } else {
        const errData = res.data as unknown as { detail?: string };
        setError(errData?.detail || 'Execution failed. Please try again.');
      }
    } catch {
      setError('Network error — could not reach the execution service.');
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, language, code]);

  /* ── Submit to interviewer ── */
  const handleSubmit = useCallback(() => {
    onSubmit(language, code, result);
  }, [onSubmit, language, code, result]);

  /* ── Render ── */
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border)',
        background: '#1a1c22',
        minWidth: 0,
      }}
    >
      {/* ── Toolbar ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          borderBottom: '1px solid #2b2d33',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={{
              background: '#26282f',
              color: '#e4e5e9',
              border: '1px solid #3a3d45',
              padding: '5px 10px',
              borderRadius: 6,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>

          <button
            onClick={handleRun}
            disabled={isRunning || !code.trim()}
            className="btn btn-sm"
            style={{
              background: '#22c55e',
              color: '#fff',
              border: 'none',
              gap: 6,
              opacity: isRunning || !code.trim() ? 0.5 : 1,
            }}
          >
            {isRunning
              ? <><Loader2 size={13} className="spin" /> Running…</>
              : <><Play size={13} /> Run Code</>
            }
          </button>
        </div>

        <button
          onClick={handleSubmit}
          className="btn btn-primary btn-sm"
          style={{ gap: 6 }}
        >
          <Send size={13} /> Submit to Interviewer
        </button>
      </div>

      {/* ── Editor ── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language={language === 'cpp' ? 'cpp' : language}
          theme="vs-dark"
          value={code}
          onChange={handleCodeChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>

      {/* ── Output Panel ── */}
      <div
        style={{
          borderTop: '1px solid #2b2d33',
          background: '#16181d',
          minHeight: 120,
          maxHeight: 220,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            borderBottom: '1px solid #2b2d33',
            padding: '0 8px',
          }}
        >
          <button
            onClick={() => setOutputTab('stdout')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: outputTab === 'stdout' ? '2px solid #22c55e' : '2px solid transparent',
              color: outputTab === 'stdout' ? '#e4e5e9' : '#6d7078',
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Terminal size={13} /> Output
          </button>
          <button
            onClick={() => setOutputTab('stderr')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: outputTab === 'stderr' ? '2px solid #f2685d' : '2px solid transparent',
              color: outputTab === 'stderr' ? '#e4e5e9' : '#6d7078',
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <AlertTriangle size={13} /> Errors
            {result?.stderr ? (
              <span
                style={{
                  background: '#5c231d',
                  color: '#f2685d',
                  fontSize: 11,
                  borderRadius: 999,
                  padding: '1px 7px',
                  fontWeight: 700,
                }}
              >!</span>
            ) : null}
          </button>

          {/* Execution metadata */}
          {result && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', padding: '0 6px' }}>
              {result.execution_time != null && (
                <span style={{ color: '#6d7078', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  {result.execution_time}s
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 999,
                  padding: '2px 8px',
                  background: result.exit_code === 0 ? '#113228' : '#3a1613',
                  color: result.exit_code === 0 ? '#3ecf8e' : '#f2685d',
                }}
              >
                exit {result.exit_code}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {error ? (
            <span style={{ color: '#f2685d' }}>{error}</span>
          ) : isRunning ? (
            <span style={{ color: '#6d7078', fontStyle: 'italic' }}>Running your code…</span>
          ) : result ? (
            <span style={{ color: outputTab === 'stderr' && result.stderr ? '#f2685d' : '#d1d5db' }}>
              {outputTab === 'stderr'
                ? (result.stderr || 'No errors.')
                : (result.stdout || '(no output)')
              }
            </span>
          ) : (
            <span style={{ color: '#6d7078', fontStyle: 'italic' }}>
              Click "Run Code" to execute your solution.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
