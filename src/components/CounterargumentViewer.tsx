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
            <span className="pill-engine-badge">
              🧠 ADVERSARIAL COUNTERARGUMENT ENGINE
            </span>
            <span className="pill-methodology">
              Probabilistic Synthesis vs Rules Ground Truth
            </span>
          </div>
          <h3 className="section-title-large">
            Forensic Synthesis & Counter-Thesis: {symbol}
          </h3>
          <p className="section-subtitle">
            Directly contrasts the prevailing directional narrative against structural counter-hypotheses,
            liquidity anomalies, and missing evidence.
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
                <span className="spinner-inline"></span>
                Synthesizing Counterarguments...
              </>
            ) : isAiAvailable ? (
              '↺ Re-synthesize with AI'
            ) : (
              '⚡ Run AI Forensic Synthesis'
            )}
          </button>
        </div>
      </div>

      {/* Uncertainty & Rigor Header Strip */}
      <div className="assessment-metrics-strip">
        <div className="strip-item">
          <span className="strip-label">ANALYTICAL CONFIDENCE</span>
          <span className={`strip-badge ${badge.className}`}>{badge.label}</span>
        </div>

        <div className="strip-item">
          <span className="strip-label">DATA COMPLETENESS</span>
          <div className="progress-group">
            <div className="progress-track">
              <div
                className="progress-fill completeness-fill"
                style={{ width: `${assessment.dataCompletenessPercent}%` }}
              ></div>
            </div>
            <strong className="font-mono">
              {assessment.dataCompletenessPercent}%
            </strong>
          </div>
        </div>

        <div className="strip-item">
          <span className="strip-label">EVIDENCE CONFLICT</span>
          <div className="progress-group">
            <div className="progress-track">
              <div
                className="progress-fill conflict-fill"
                style={{ width: `${assessment.evidenceConflictPercent ?? 0}%` }}
              ></div>
            </div>
            <strong className="font-mono">
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
          <p className="loading-text">
            Formulating adversarial market hypothesis and inspecting order book / liquidity dynamics...
          </p>
        </div>
      )}

      {/* Unconfigured Notice */}
      {!isLoadingAi && isAiUnavailable && (
        <div className="ai-alert-banner banner-info">
          <div className="alert-icon">ℹ</div>
          <div>
            <strong>AI Provider Not Configured</strong>
            <p>{aiExplanation.reason}</p>
            <p className="text-muted alert-subtext">
              To activate automated LLM counterarguments, provide <code>AI_API_KEY</code> and optional <code>AI_BASE_URL</code> in your environment.
              All deterministic forensic indicators, threshold calculations, and evidence conflict ratings remain active.
            </p>
          </div>
        </div>
      )}

      {/* Error Notice */}
      {!isLoadingAi && isAiError && (
        <div className="ai-alert-banner banner-warning">
          <div className="alert-icon">⚠️</div>
          <div>
            <strong>AI Provider Error</strong>
            <p>{aiExplanation.reason}</p>
            <p className="text-muted alert-subtext">
              The deterministic investigation report below is untouched and completely valid. You may retry synthesis using the button above.
            </p>
          </div>
        </div>
      )}

      {/* Not run yet state */}
      {!isLoadingAi && !aiExplanation && (
        <div className="ai-prompt-box">
          <p>
            Click <strong>"Run AI Forensic Synthesis"</strong> to generate an adversarial counterargument analysis comparing the primary narrative against skepticism, liquidity traps, and missing market data.
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
                <span className="thesis-badge badge-primary">LEADING THESIS</span>
                <h4 className="thesis-title">Observed Market Interpretation</h4>
              </div>
              <p className="thesis-body">{aiExplanation.explanation.mainInterpretation}</p>

              {aiExplanation.explanation.supportingCase.length > 0 && (
                <div className="thesis-points">
                  <h5 className="points-title">Supporting Evidence:</h5>
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
                <span className="thesis-badge badge-counter">SKEPTICAL COUNTERARGUMENT</span>
                <h4 className="thesis-title">Adversarial Forensic Case</h4>
              </div>
              <p className="thesis-body">{aiExplanation.explanation.counterargument}</p>

              {aiExplanation.explanation.alternativeExplanations.length > 0 && (
                <div className="thesis-points">
                  <h5 className="points-title">Alternative Hypotheses:</h5>
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
                <span className="sub-icon">🔍</span>
                <h4 className="sub-title">Required Missing Evidence</h4>
              </div>
              <p className="sub-desc text-muted">
                Unobserved market data points necessary to confirm or falsify this hypothesis:
              </p>
              <ul className="sub-list">
                {aiExplanation.explanation.missingEvidence.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="sub-panel panel-uncertainty">
              <div className="sub-panel-header">
                <span className="sub-icon">⚖</span>
                <h4 className="sub-title">Uncertainty Assessment</h4>
                <span className={`badge-uncertainty ${badge.className}`}>
                  {aiExplanation.explanation.uncertainty.rating}
                </span>
              </div>
              <p className="sub-desc text-muted">Key factors contributing to analytical ambiguity:</p>
              <ul className="sub-list">
                {aiExplanation.explanation.uncertainty.reasons.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="synthesis-metadata text-muted font-mono">
            <span>Model: {aiExplanation.model}</span>
            <span>Provider: {aiExplanation.provider}</span>
            <span>Generated: {new Date(aiExplanation.generatedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}
