'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Plus, Trash2, ShieldCheck, Loader2 } from 'lucide-react';

interface RuleDraft {
  localId: string;
  kind: 'blocked_topic' | 'sensitive_pattern';
  pattern: string;
  message: string;
}

interface ClauseDraft {
  localId: string;
  text: string;
  action: 'prohibit' | 'conditional' | 'permit';
  note: string;
}

interface CurrentPolicy {
  policy: { id: string; name: string; source_text: string; created_at: string } | null;
  rules: Array<{ id: string; kind: string; pattern: string; message: string }>;
  clauses: Array<{ id: string; text: string; action: string; note: string | null }>;
}

function newLocalId(): string {
  return Math.random().toString(36).slice(2);
}

export default function PolicyPage() {
  const [current, setCurrent] = useState<CurrentPolicy | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isMockExtraction, setIsMockExtraction] = useState(false);

  const [draftName, setDraftName] = useState('');
  const [draftSourceText, setDraftSourceText] = useState('');
  const [draftRules, setDraftRules] = useState<RuleDraft[]>([]);
  const [draftClauses, setDraftClauses] = useState<ClauseDraft[]>([]);
  const [hasDraft, setHasDraft] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedNotice, setPublishedNotice] = useState<string | null>(null);

  const loadCurrent = useCallback(async () => {
    setLoadingCurrent(true);
    try {
      const res = await fetch('/api/policy/current');
      if (res.ok) {
        setCurrent(await res.json());
      }
    } catch (err) {
      console.error('Failed to load current policy:', err);
    } finally {
      setLoadingCurrent(false);
    }
  }, []);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setExtractError(null);
    setPublishedNotice(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/policy/extract', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Extraction failed.');
      }

      setDraftName(data.name);
      setDraftSourceText(data.sourceText);
      setDraftRules(
        (data.rules as Array<{ kind: string; pattern: string; message: string }>).map(r => ({
          localId: newLocalId(),
          kind: (r.kind === 'blocked_topic' ? 'blocked_topic' : 'sensitive_pattern') as RuleDraft['kind'],
          pattern: r.pattern,
          message: r.message,
        }))
      );
      setDraftClauses(
        (data.clauses as Array<{ text: string; action: string; note?: string }>).map(c => ({
          localId: newLocalId(),
          text: c.text,
          action: (['prohibit', 'conditional', 'permit'].includes(c.action) ? c.action : 'conditional') as ClauseDraft['action'],
          note: c.note || '',
        }))
      );
      setIsMockExtraction(Boolean(data.isMock));
      setHasDraft(true);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch('/api/policy/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draftName,
          sourceText: draftSourceText,
          rules: draftRules.map(({ kind, pattern, message }) => ({ kind, pattern, message })),
          clauses: draftClauses.map(({ text, action, note }) => ({ text, action, note })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Publish failed.');
      }

      setPublishedNotice(`Published — ${data.ruleCount} rule(s), ${data.clauseCount} clause(s) now active.`);
      setHasDraft(false);
      setFile(null);
      await loadCurrent();
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-[#15181C]">
      <div className="flex items-center gap-3 px-6 py-3.5 hairline-b">
        <Link href="/" className="flex items-center gap-1.5 text-xs text-[#575D65] hover:text-[#15181C] transition-colors">
          <ArrowLeft size={14} />
          <span>Back to chat</span>
        </Link>
        <span className="text-[#E2E0DA]">|</span>
        <span className="text-xs uppercase tracking-wider text-[#575D65] font-semibold">Policy Administration</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        {/* Current active policy */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Current active policy (Gate 1)</h2>
          {loadingCurrent ? (
            <p className="text-xs text-[#575D65]">Loading…</p>
          ) : current?.policy ? (
            <div className="hairline rounded-xs p-4 bg-white space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-[#2F6B4F]" />
                <span className="text-sm font-medium">{current.policy.name}</span>
              </div>
              <p className="text-xs text-[#575D65]">
                {current.rules.length} pattern rule(s) · {current.clauses.length} clause(s) · active since{' '}
                {new Date(current.policy.created_at).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-xs text-[#575D65]">No active policy configured — all requests pass Gate 1 unchecked.</p>
          )}
        </section>

        {/* Upload */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Upload an updated policy (PDF)</h2>
          <p className="text-xs text-[#575D65]">
            The document is read locally and sent to your configured model provider to draft candidate rules and
            clauses. Nothing goes live until you review and publish below.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="application/pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="text-xs"
            />
            <button
              onClick={handleExtract}
              disabled={!file || extracting}
              className="px-3 py-1.5 rounded-xs font-medium text-xs flex items-center gap-1.5 bg-[#15181C] hover:bg-[#2C3138] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {extracting ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              <span>{extracting ? 'Extracting…' : 'Extract draft'}</span>
            </button>
          </div>
          {extractError && <p className="text-xs text-[#8F2C27]">{extractError}</p>}
          {isMockExtraction && hasDraft && (
            <p className="text-xs text-[#9A6B18]">
              No model provider API key is configured — this is an illustrative mock draft, not a real extraction of
              your document. Set an API key to get real results.
            </p>
          )}
        </section>

        {/* Draft review */}
        {hasDraft && (
          <section className="space-y-5">
            <h2 className="text-sm font-semibold">Review draft before publishing</h2>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#575D65]">Policy name</label>
              <input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                className="w-full p-2 border border-[#E2E0DA] rounded-xs text-sm bg-white"
              />
            </div>

            {/* Rules */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#575D65]">
                  Pattern rules (draft — verify regex before trusting)
                </h3>
                <button
                  onClick={() =>
                    setDraftRules(r => [...r, { localId: newLocalId(), kind: 'sensitive_pattern', pattern: '', message: '' }])
                  }
                  className="text-xs flex items-center gap-1 text-[#575D65] hover:text-[#15181C] cursor-pointer"
                >
                  <Plus size={13} /> Add rule
                </button>
              </div>
              <div className="space-y-2">
                {draftRules.map((rule, idx) => (
                  <div key={rule.localId} className="hairline rounded-xs p-3 bg-white space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={rule.kind}
                        onChange={e =>
                          setDraftRules(rs =>
                            rs.map((r, i) => (i === idx ? { ...r, kind: e.target.value as RuleDraft['kind'] } : r))
                          )
                        }
                        className="text-xs border border-[#E2E0DA] rounded-xs p-1 bg-white"
                      >
                        <option value="sensitive_pattern">sensitive_pattern</option>
                        <option value="blocked_topic">blocked_topic</option>
                      </select>
                      <button
                        onClick={() => setDraftRules(rs => rs.filter((_, i) => i !== idx))}
                        className="ml-auto text-[#8F2C27] hover:text-[#74231E] cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <input
                      value={rule.pattern}
                      onChange={e =>
                        setDraftRules(rs => rs.map((r, i) => (i === idx ? { ...r, pattern: e.target.value } : r)))
                      }
                      placeholder="Regex pattern"
                      className="w-full p-1.5 border border-[#E2E0DA] rounded-xs text-xs font-mono bg-[#FBFBF9]"
                    />
                    <input
                      value={rule.message}
                      onChange={e =>
                        setDraftRules(rs => rs.map((r, i) => (i === idx ? { ...r, message: e.target.value } : r)))
                      }
                      placeholder="User-facing block message"
                      className="w-full p-1.5 border border-[#E2E0DA] rounded-xs text-xs bg-[#FBFBF9]"
                    />
                  </div>
                ))}
                {draftRules.length === 0 && <p className="text-xs text-[#575D65]">No pattern rules in this draft.</p>}
              </div>
            </div>

            {/* Clauses */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#575D65]">Semantic clauses</h3>
                <button
                  onClick={() =>
                    setDraftClauses(c => [...c, { localId: newLocalId(), text: '', action: 'conditional', note: '' }])
                  }
                  className="text-xs flex items-center gap-1 text-[#575D65] hover:text-[#15181C] cursor-pointer"
                >
                  <Plus size={13} /> Add clause
                </button>
              </div>
              <div className="space-y-2">
                {draftClauses.map((clause, idx) => (
                  <div key={clause.localId} className="hairline rounded-xs p-3 bg-white space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={clause.action}
                        onChange={e =>
                          setDraftClauses(cs =>
                            cs.map((c, i) => (i === idx ? { ...c, action: e.target.value as ClauseDraft['action'] } : c))
                          )
                        }
                        className="text-xs border border-[#E2E0DA] rounded-xs p-1 bg-white"
                      >
                        <option value="prohibit">prohibit</option>
                        <option value="conditional">conditional</option>
                        <option value="permit">permit</option>
                      </select>
                      <button
                        onClick={() => setDraftClauses(cs => cs.filter((_, i) => i !== idx))}
                        className="ml-auto text-[#8F2C27] hover:text-[#74231E] cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <textarea
                      value={clause.text}
                      onChange={e =>
                        setDraftClauses(cs => cs.map((c, i) => (i === idx ? { ...c, text: e.target.value } : c)))
                      }
                      placeholder="Clause text"
                      rows={2}
                      className="w-full p-1.5 border border-[#E2E0DA] rounded-xs text-xs font-reading bg-[#FBFBF9] resize-none"
                    />
                    <input
                      value={clause.note}
                      onChange={e =>
                        setDraftClauses(cs => cs.map((c, i) => (i === idx ? { ...c, note: e.target.value } : c)))
                      }
                      placeholder="Note / caveat shown to the user"
                      className="w-full p-1.5 border border-[#E2E0DA] rounded-xs text-xs bg-[#FBFBF9]"
                    />
                  </div>
                ))}
                {draftClauses.length === 0 && <p className="text-xs text-[#575D65]">No clauses in this draft.</p>}
              </div>
            </div>

            {publishError && <p className="text-xs text-[#8F2C27]">{publishError}</p>}

            <button
              onClick={handlePublish}
              disabled={publishing || (draftRules.length === 0 && draftClauses.length === 0)}
              className="px-4 py-2 rounded-xs font-medium text-xs flex items-center gap-1.5 bg-[#15181C] hover:bg-[#2C3138] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {publishing && <Loader2 size={13} className="animate-spin" />}
              <span>{publishing ? 'Publishing…' : 'Publish as active policy'}</span>
            </button>
          </section>
        )}

        {publishedNotice && (
          <p className="text-xs text-[#2F6B4F] font-medium hairline rounded-xs p-3 bg-white">{publishedNotice}</p>
        )}
      </div>
    </div>
  );
}
