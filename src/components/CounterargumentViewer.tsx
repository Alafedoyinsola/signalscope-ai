import type { AiExplanationResult, AssessmentResult } from '../types/forensics.ts'

interface CounterargumentViewerProps {
  aiExplanation: AiExplanationResult | null
  assessment: AssessmentResult
  isLoadingAi: boolean
  onRunAiExplanation: () => void
  symbol: string
}

const CONFIDENCE_BADGES: Record<
  string,
  { label: string; className: string }
> = {
  HIGH: { label: 'HIGH CONFIDENCE', className: 'conf-high' },
  MODERATE: { label: 'MODERATE CONFIDENCE', className: 'conf-mod' },
  TENTATIVE: { label: 'TENTATIVE', className: 'conf-tentative' },
  INCONCLUSIVE: { label: 'INCONCLUSIVE', className: 'conf-inconclusive' },
}

export function CounterargumentViewer({
  aiExplanation,
  assessment,
  isLoadingAi,
  onRunAiExplanation,
  symbol,
}: CounterargumentViewerProps) {
  const badge = CONFIDENCE_BADGES[assessment.confidenceRating] || {
    label: assessment.confidenceRating,
    className: 'conf-inconclusive',
  }

  const isAiAvailable = aiExplanation?.status === 'available'
  const isAiUnavailable = aiExplanation?.status === 'unavailable'
  const isAiError = aiExplanation?.status === 'error'

  return (
    <div className="card counterargument-section">
      <div className="counterargument-header">
        <div>
          <div className="section-pill-row">
            <span className="pill-engine-badge font-mono">
              ADVERSARIAL COUNTER-THESIS ENGINE
            </span>
            <span className="pill-methodology font-mono">
              Probabilistic Synthesis Grounded in Deterministic Rules
            </span>
          </div>
          <h3 className="section-title-large">
            Forensic Synthesis &amp; Counter-Hypothesis: {symbol}
          </h3>
          <p className="section-subtitle">
            Cross-examines the primary market momentum against structural liquidity traps, supply overhangs &amp; missing evidence.
          </p>
        </div>

        <div className="ai-controls">
          <button
            type="button"
            className="btn-run-ai"
            onClick={onRunAiExplanation}
            disabled={isLoadingAi}
          >
            {isLoadingAi ? (
              <>
                <svg className="btn-spinner" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <span>SYNTHESIZING COUNTER-THESIS...</span>
              </>
            ) : isAiAvailable ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span>RE-SYNTHESIZE COUNTER-THESIS</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span>RUN ADVERSARIAL AI SYNTHESIS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Uncertainty & Rigor Header Strip */}
      <div className="assessment-metrics-strip">
        <div className="strip-item">
          <span className="strip-label font-mono">ANALYTICAL CONFIDENCE</span>
          <span className={`strip-badge font-mono ${badge.className}`}>{badge.label}</span>
        </div>

        <div className="strip-item">
          <span className="strip-label font-mono">DATA COMPLETENESS</span>
          <div className="progress-group">
            <div className="progress-track">
              <div
                className="progress-fill completeness-fill"
                style={{ width: `${assessment.dataCompletenessPercent}%` }}
              ></div>
            </div>
            <strong className="font-mono text-silver">
              {assessment.dataCompletenessPercent}%
            </strong>
          </div>
        </div>

        <div className="strip-item">
          <span className="strip-label font-mono">EVIDENCE CONFLICT</span>
          <div className="progress-group">
            <div className="progress-track">
              <div
                className="progress-fill conflict-fill"
                style={{ width: `${assessment.evidenceConflictPercent ?? 0}%` }}
              ></div>
            </div>
            <strong className="font-mono text-silver">
              {assessment.evidenceConflictPercent !== null
                ? `${assessment.evidenceConflictPercent}%`
                : '0%'}
            </strong>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoadingAi && (
        <div className="ai-loading-box">
          <div className="spinner"></div>
          <p className="loading-text font-mono">
            Evaluating structural liquidity dynamics, wash-trading artifacts &amp; orderbook imbalances...
          </p>
        </div>
      )}

      {/* Unconfigured Notice */}
      {!isLoadingAi && isAiUnavailable && (
        <div className="ai-alert-banner banner-info">
          <svg className="alert-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong className="alert-heading">AI Synthesis Engine Not Configured</strong>
            <p className="alert-body">{aiExplanation.reason}</p>
            <p className="text-dim alert-subtext font-mono">
              Provide <code>AI_API_KEY</code> and optional <code>AI_BASE_URL</code> in hosting configuration to enable automated LLM counterarguments.
              All deterministic forensic indicators, threshold equations &amp; confidence ratings remain 100% active.
            </p>
          </div>
        </div>
      )}

      {/* Error Notice */}
      {!isLoadingAi && isAiError && (
        <div className="ai-alert-banner banner-warning">
          <svg className="alert-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <strong className="alert-heading">AI Provider Unreachable</strong>
            <p className="alert-body">{aiExplanation.reason}</p>
            <p className="text-dim alert-subtext font-mono">
              The deterministic ground-truth investigation report below is verified and fully functional. You may retry synthesis using the button above.
            </p>
          </div>
        </div>
      )}

      {/* Not run yet state */}
      {!isLoadingAi && !aiExplanation && (
        <div className="ai-prompt-box">
          <p className="prompt-text">
            Execute <strong>"Run Adversarial AI Synthesis"</strong> to generate a structured counter-thesis challenging the primary price momentum against liquidity anomalies, dilution traps &amp; missing orderflow metrics.
          </p>
        </div>
      )}

      {/* Successful AI Synthesis Display */}
      {!isLoadingAi && isAiAvailable && (
        <div className="synthesis-content">
          {/* Side-by-Side: Primary Thesis vs Counterargument */}
          <div className="thesis-contrast-grid">
            {/* Primary Interpretation */}
            <div className="thesis-card card-thesis-primary">
              <div className="thesis-header">
                <span className="thesis-badge badge-primary font-mono">LEADING THESIS</span>
                <h4 className="thesis-title">Observed Market Interpretation</h4>
              </div>
              <p className="thesis-body">{aiExplanation.explanation.mainInterpretation}</p>

              {aiExplanation.explanation.supportingCase.length > 0 && (
                <div className="thesis-points">
                  <h5 className="points-title font-mono">SUPPORTING EVIDENCE:</h5>
                  <ul>
                    {aiExplanation.explanation.supportingCase.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Counterargument Card */}
            <div className="thesis-card card-thesis-counter">
              <div className="thesis-header">
                <span className="thesis-badge badge-counter font-mono">ADVERSARIAL COUNTERARGUMENT</span>
                <h4 className="thesis-title">Skeptical Forensic Case</h4>
              </div>
              <p className="thesis-body">{aiExplanation.explanation.counterargument}</p>

              {aiExplanation.explanation.alternativeExplanations.length > 0 && (
                <div className="thesis-points">
                  <h5 className="points-title font-mono">ALTERNATIVE STRUCTURAL HYPOTHESES:</h5>
                  <ul>
                    {aiExplanation.explanation.alternativeExplanations.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Missing Evidence & Analytical Uncertainty */}
          <div className="evidence-uncertainty-grid">
            <div className="sub-panel panel-missing-evidence">
              <div className="sub-panel-header">
                <svg className="sub-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <h4 className="sub-title">Required Missing Evidence</h4>
              </div>
              <p className="sub-desc text-muted font-mono">
                Unobserved market data points necessary to confirm or falsify this hypothesis:
              </p>
              <ul className="sub-list font-mono">
                {aiExplanation.explanation.missingEvidence.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="sub-panel panel-uncertainty">
              <div className="sub-panel-header">
                <svg className="sub-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                <h4 className="sub-title">Analytical Uncertainty Assessment</h4>
                <span className={`badge-uncertainty font-mono ${badge.className}`}>
                  {aiExplanation.explanation.uncertainty.rating}
                </span>
              </div>
              <p className="sub-desc text-muted font-mono">Key factors contributing to analytical ambiguity:</p>
              <ul className="sub-list font-mono">
                {aiExplanation.explanation.uncertainty.reasons.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="synthesis-metadata text-dim font-mono">
            <span>MODEL: {aiExplanation.model}</span>
            <span>PROVIDER: {aiExplanation.provider}</span>
            <span>TIMESTAMP: {new Date(aiExplanation.generatedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}
