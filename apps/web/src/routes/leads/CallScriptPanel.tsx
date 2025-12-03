// apps/web/src/routes/leads/CallScriptPanel.tsx

import React, { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import {
  getCallScripts,
  startCallScriptRun,
  stepCallScriptRun,
  endCallScriptRun,
  getCallScriptRunsForLead,
  type CallScript,
  type CallScriptNode,
  type ScriptRunStatus,
  type CallScriptRunSummary,
} from "../../lib/apiClient";

interface CallScriptPanelProps {
  leadId: string;
}

/**
 * CallScriptPanel
 *
 * Phase 0 UI for interactive call scripts on a single lead.
 * - Lists active scripts
 * - Lets the agent start a script run
 * - Steps through nodes based on lead responses
 * - Ends the script run
 * - Shows recent script runs for this lead
 *
 * NOTE: This component does not wrap itself in a Card. The parent
 * (LeadDetail) should render it inside a Card.
 */
export const CallScriptPanel: React.FC<CallScriptPanelProps> = ({ leadId }) => {
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [scriptsError, setScriptsError] = useState<string | null>(null);

  const [selectedScriptId, setSelectedScriptId] = useState<string>("");

  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<ScriptRunStatus | null>(null);
  const [currentNode, setCurrentNode] = useState<CallScriptNode | null>(null);
  const [currentScript, setCurrentScript] = useState<CallScript | null>(null);
  const [startingRun, setStartingRun] = useState(false);
  const [stepping, setStepping] = useState(false);
  const [endingRun, setEndingRun] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [history, setHistory] = useState<CallScriptRunSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Load scripts on mount
  useEffect(() => {
    let mounted = true;
    async function loadScripts() {
      setLoadingScripts(true);
      setScriptsError(null);
      try {
        const res = await getCallScripts();
        if (!mounted) return;
        setScripts(res.scripts || []);
        if (res.scripts && res.scripts.length > 0) {
          setSelectedScriptId(res.scripts[0].id);
        }
      } catch (err: any) {
        if (!mounted) return;
        setScriptsError(err?.message ?? "Failed to load call scripts");
      } finally {
        if (mounted) setLoadingScripts(false);
      }
    }
    void loadScripts();
    return () => {
      mounted = false;
    };
  }, []);

  // Load recent runs history
  async function refreshHistory() {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await getCallScriptRunsForLead(leadId);
      setHistory(res.runs || []);
    } catch (err: any) {
      setHistoryError(err?.message ?? "Failed to load script run history");
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    void refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const hasActiveRun = runId !== null && runStatus === "IN_PROGRESS";

  async function handleStartRun() {
    if (!selectedScriptId) return;
    setStartingRun(true);
    setRunError(null);
    try {
      const res = await startCallScriptRun({
        leadId,
        scriptId: selectedScriptId,
      });
      setRunId(res.runId);
      setCurrentScript(res.script);
      setCurrentNode(res.currentNode);
      setRunStatus("IN_PROGRESS");
    } catch (err: any) {
      setRunError(err?.message ?? "Failed to start scripted call");
    } finally {
      setStartingRun(false);
      void refreshHistory();
    }
  }

  async function handleStep(optionId: string) {
    if (!runId) return;
    setStepping(true);
    setRunError(null);
    try {
      const res = await stepCallScriptRun(runId, optionId);
      setRunStatus(res.status);
      setCurrentNode(res.currentNode);
    } catch (err: any) {
      setRunError(err?.message ?? "Failed to advance script");
    } finally {
      setStepping(false);
      void refreshHistory();
    }
  }

  async function handleEndRun(status: ScriptRunStatus = "ABANDONED") {
    if (!runId) return;
    setEndingRun(true);
    setRunError(null);
    try {
      await endCallScriptRun({ runId, status });
      setRunStatus(status);
    } catch (err: any) {
      setRunError(err?.message ?? "Failed to end scripted call");
    } finally {
      setEndingRun(false);
      void refreshHistory();
    }
  }

  function handleResetRunState() {
    setRunId(null);
    setRunStatus(null);
    setCurrentNode(null);
    setCurrentScript(null);
    setRunError(null);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      {/* Script selector + start */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 500,
              }}
            >
              Select script
            </span>
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Choose an active call script to guide this conversation.
            </span>
          </div>
          {hasActiveRun && <Badge variant="info">Script in progress</Badge>}
        </div>

        {scriptsError && (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-danger)",
            }}
          >
            {scriptsError}
          </div>
        )}

        {loadingScripts ? (
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
            }}
          >
            Loading scripts…
          </div>
        ) : scripts.length === 0 ? (
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
            }}
          >
            No active call scripts are configured for this environment.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              alignItems: "center",
            }}
          >
            <select
              value={selectedScriptId}
              onChange={(e) => setSelectedScriptId(e.target.value)}
              disabled={hasActiveRun || startingRun}
              style={{
                flex: 1,
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border-subtle)",
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-primary)",
                fontSize: "var(--text-sm)",
              }}
            >
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.purpose}
                </option>
              ))}
            </select>

            {!hasActiveRun ? (
              <Button
                size="sm"
                disabled={!selectedScriptId || startingRun}
                onClick={handleStartRun}
              >
                {startingRun ? "Starting…" : "Start scripted call"}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={endingRun}
                onClick={() => handleEndRun("ABANDONED")}
              >
                {endingRun ? "Ending…" : "End script"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Active run view */}
      {runError && (
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-danger)",
          }}
        >
          {runError}
        </div>
      )}

      {runId && currentScript && (
        <div
          style={{
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-subtle)",
            padding: "var(--space-3)",
            backgroundColor: "var(--color-bg-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.15rem",
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: 500,
                }}
              >
                {currentScript.name}
              </span>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Purpose:{" "}
                <span style={{ fontWeight: 500 }}>{currentScript.purpose}</span>
              </span>
            </div>
            <Badge
              variant={
                runStatus === "COMPLETED"
                  ? "success"
                  : runStatus === "ABANDONED"
                  ? "warning"
                  : "info"
              }
            >
              {runStatus ?? "IN_PROGRESS"}
            </Badge>
          </div>

          {runStatus === "IN_PROGRESS" && currentNode && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <div
                style={{
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(15,23,42,0.6)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-soft)",
                    marginBottom: "0.25rem",
                  }}
                >
                  Agent script
                </div>
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {currentNode.content}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-soft)",
                  }}
                >
                  Lead responds with:
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  {currentNode.options.length === 0 ? (
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      No response options configured for this node.
                    </span>
                  ) : (
                    currentNode.options.map((opt) => (
                      <Button
                        key={opt.id}
                        size="sm"
                        disabled={stepping}
                        onClick={() => handleStep(opt.id)}
                      >
                        {opt.label}
                      </Button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {runStatus === "IN_PROGRESS" && !currentNode && (
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              This script has no starting node configured. Please contact an
              admin to fix the script definition.
            </div>
          )}

          {runStatus && runStatus !== "IN_PROGRESS" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-soft)",
                }}
              >
                Script run is{" "}
                <span style={{ fontWeight: 500 }}>{runStatus}</span>. You can
                start a new scripted call if needed.
              </div>
              <div>
                <Button size="sm" variant="secondary" onClick={handleResetRunState}>
                  Start a new run
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <div
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 500,
          }}
        >
          Recent script runs
        </div>
        {historyError && (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-danger)",
            }}
          >
            {historyError}
          </div>
        )}
        {loadingHistory ? (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            Loading history…
          </div>
        ) : history.length === 0 ? (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            No prior script runs recorded for this lead.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            {history.map((run) => (
              <div
                key={run.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "0.35rem 0",
                  borderBottom: "1px solid rgba(15,23,42,0.5)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.1rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: 500,
                    }}
                  >
                    {run.scriptName}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    {run.purpose} •{" "}
                    {new Date(run.startedAt).toLocaleString()}
                  </span>
                </div>
                <Badge
                  variant={
                    run.status === "COMPLETED"
                      ? "success"
                      : run.status === "ABANDONED"
                      ? "warning"
                      : "info"
                  }
                >
                  {run.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

