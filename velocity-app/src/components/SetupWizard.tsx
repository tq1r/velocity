import { useState, useEffect, useCallback } from 'react';
import { useVelocityStore } from '../state/store';
import { getLocalModelStatus, startLocalModelDownload } from '../lib/tauri';

interface SetupWizardProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'ai-provider' | 'model-download' | 'api-key' | 'theme' | 'ready';

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const store = useVelocityStore();
  const [step, setStep] = useState<Step>('welcome');
  const [aiChoice, setAiChoice] = useState<'local' | 'cloud' | null>(null);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelPhase, setModelPhase] = useState('');
  const [modelError, setModelError] = useState('');
  const [modelAvailable, setModelAvailable] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<'velocity-night' | 'midnight-blue' | 'graphite'>('velocity-night');
  const [selectedAccent, setSelectedAccent] = useState<'violet' | 'cyan' | 'emerald' | 'amber'>('violet');

  useEffect(() => {
    if (aiChoice === 'local' && step === 'model-download') {
      checkLocalModelStatus();
    }
  }, [aiChoice, step]);

  const checkLocalModelStatus = async () => {
    try {
      const status = await getLocalModelStatus();
      if (status.available) {
        setModelAvailable(true);
        setModelPhase('Engine ready');
        setModelProgress(100);
        return;
      }
      if (status.model_downloaded) {
        setModelAvailable(true);
        setModelPhase('Model ready');
        setModelProgress(100);
        return;
      }
    } catch {
      // Engine not available yet
    }
    setModelAvailable(false);
  };

  const handleStartDownload = async () => {
    setModelPhase('Downloading Velocity Model (1.1 GB)...');
    setModelProgress(0);
    setModelError('');

    try {
      const result = await startLocalModelDownload();
      setModelProgress(100);
      setModelPhase('Model ready!');
      setModelAvailable(true);
    } catch (err) {
      setModelError(String(err));
      setModelPhase('Download failed');
    }
  };

  const applyTheme = useCallback((theme: string, accent: string) => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accent);
  }, []);

  const handleThemeChange = (theme: 'velocity-night' | 'midnight-blue' | 'graphite') => {
    setSelectedTheme(theme);
    applyTheme(theme, selectedAccent);
  };

  const handleAccentChange = (accent: 'violet' | 'cyan' | 'emerald' | 'amber') => {
    setSelectedAccent(accent);
    applyTheme(selectedTheme, accent);
  };

  const handleFinish = () => {
    if (store.settings) {
      store.setSettings({
        ...store.settings,
        theme: selectedTheme,
        accent: selectedAccent,
        ai: {
          ...store.settings.ai,
          use_local_model: aiChoice === 'local',
          api_key: aiChoice === 'cloud' ? apiKey || store.settings.ai.api_key : null,
          provider_name: aiChoice === 'cloud' ? 'custom' : 'local',
        },
      });
    }
    store.setStatusText('Setup complete');
    onComplete();
  };

  const nextStep = () => {
    const steps: Step[] = ['welcome', 'ai-provider', 'model-download', 'api-key', 'theme', 'ready'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      const next = steps[currentIndex + 1];
      if (next === 'api-key' && aiChoice !== 'cloud') {
        setStep('theme');
      } else if (next === 'model-download' && aiChoice !== 'local') {
        setStep('theme');
      } else {
        setStep(next);
      }
    }
  };

  const prevStep = () => {
    const steps: Step[] = ['welcome', 'ai-provider', 'model-download', 'api-key', 'theme', 'ready'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 200, backdropFilter: 'blur(8px)' }}>
      <div className="modal-content animate-in" style={{ maxWidth: 640, background: 'var(--bg-secondary)' }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--border-primary)', borderRadius: '2px 2px 0 0', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: step === 'welcome' ? '0%' :
                   step === 'ai-provider' ? '20%' :
                   step === 'model-download' ? '40%' :
                   step === 'api-key' ? '60%' :
                   step === 'theme' ? '80%' : '100%',
            background: 'var(--text-accent)',
            transition: 'width 0.4s ease',
            borderRadius: 2,
          }} />
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {step === 'welcome' && (
            <div style={{ textAlign: 'center', padding: '48px 40px 40px' }}>
              <div style={{
                width: 80, height: 80, borderRadius: 20,
                background: 'linear-gradient(135deg, var(--text-accent), #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px', fontSize: 36,
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                Welcome to <span style={{ color: 'var(--text-accent)' }}>Velocity</span>
              </h1>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto 32px' }}>
                A premium AI-powered code editor built for professionals.
                Let's get you set up in just a few steps.
              </p>
              <button
                className="onboarding-btn"
                onClick={nextStep}
                style={{ padding: '12px 40px', fontSize: 15 }}
              >
                Get Started
              </button>
            </div>
          )}

          {step === 'ai-provider' && (
            <div style={{ padding: '40px' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Choose Your AI Engine</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.5 }}>
                Velocity uses AI to help you write, refactor, and debug code. Pick how you want to power it.
              </p>
              <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
                <button
                  onClick={() => { setAiChoice('local'); }}
                  style={{
                    flex: 1, padding: '24px 20px', borderRadius: 12,
                    background: aiChoice === 'local' ? 'var(--accent-glow)' : 'var(--bg-surface)',
                    border: aiChoice === 'local' ? '2px solid var(--text-accent)' : '1px solid var(--border-primary)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 12 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h.01"/><path d="M15 9h.01"/><path d="M9 15h6"/><path d="M9 12h6"/>
                    </svg>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                    Velocity Model (Local)
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Runs entirely on your machine. No API key needed. Downloads a small 1.5B parameter model (~1.1 GB).
                    Works offline. Privacy-first.
                  </p>
                  <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>Free</span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>Offline</span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>Private</span>
                  </div>
                </button>
                <button
                  onClick={() => { setAiChoice('cloud'); }}
                  style={{
                    flex: 1, padding: '24px 20px', borderRadius: 12,
                    background: aiChoice === 'cloud' ? 'var(--accent-glow)' : 'var(--bg-surface)',
                    border: aiChoice === 'cloud' ? '2px solid var(--text-accent)' : '1px solid var(--border-primary)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 12 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
                    </svg>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                    Cloud Provider
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Connect to OpenAI, Anthropic, or any OpenAI-compatible API.
                    More powerful models, requires API key and internet.
                  </p>
                  <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>Powerful</span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>API Key</span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>Online</span>
                  </div>
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="ai-action-btn" onClick={prevStep}>Back</button>
                <button
                  className="ai-action-btn active"
                  onClick={nextStep}
                  style={{ opacity: aiChoice ? 1 : 0.4 }}
                  disabled={!aiChoice}
                >
                  {aiChoice === 'local' ? 'Use Local Model' : 'Configure Cloud'}
                </button>
              </div>
            </div>
          )}

          {step === 'model-download' && (
            <div style={{ padding: '40px' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Download Velocity Model</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.5 }}>
                We'll download a small but capable model (Qwen2.5-1.5B, ~1.1 GB) that runs entirely on your machine.
                No data leaves your computer.
              </p>

              {modelAvailable ? (
                <div style={{
                  textAlign: 'center', padding: '40px 0',
                }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 8 }}>Velocity Model is ready to use</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
                    {modelPhase}
                  </p>
                  <button className="ai-action-btn active" onClick={() => setStep('theme')}>
                    Continue
                  </button>
                </div>
              ) : (
                <>
                  <div style={{
                    background: 'var(--bg-surface)', borderRadius: 12, padding: 24,
                    border: '1px solid var(--border-primary)', marginBottom: 24,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'var(--accent-glow)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
                        </svg>
                      </div>
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Qwen2.5 1.5B (Q4_K_M)</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>1.1 GB download • Runs on CPU</p>
                      </div>
                    </div>
                    {modelPhase && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          fontSize: 12, color: 'var(--text-muted)', marginBottom: 6,
                        }}>
                          <span>{modelPhase}</span>
                          <span>{Math.round(modelProgress)}%</span>
                        </div>
                        <div style={{
                          height: 6, background: 'var(--bg-tertiary)',
                          borderRadius: 3, overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', width: `${modelProgress}%`,
                            background: 'linear-gradient(90deg, var(--text-accent), #7c3aed)',
                            borderRadius: 3, transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </div>
                    )}
                    {modelError && (
                      <div style={{
                        padding: '10px 14px', borderRadius: 8,
                        background: 'rgba(252, 165, 165, 0.1)',
                        border: '1px solid rgba(252, 165, 165, 0.2)',
                        color: '#fca5a5', fontSize: 13, marginBottom: 12,
                      }}>
                        {modelError}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button className="ai-action-btn" onClick={prevStep}>Back</button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="ai-action-btn" onClick={() => { setAiChoice('cloud'); setStep('api-key'); }}>
                        Skip — Use Cloud AI
                      </button>
                      <button
                        className="ai-action-btn active"
                        onClick={handleStartDownload}
                        disabled={!!modelPhase && !modelError}
                      >
                        {modelError ? 'Retry Download' : 'Download Model'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'api-key' && (
            <div style={{ padding: '40px' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Configure Cloud AI</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.5 }}>
                Enter your API key for OpenAI, Anthropic, or any OpenAI-compatible provider.
                Your key is stored locally and never shared.
              </p>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                  API Key
                </label>
                <input
                  className="settings-input"
                  style={{ width: '100%', padding: '10px 14px' }}
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                  API Base URL (optional)
                </label>
                <input
                  className="settings-input"
                  style={{ width: '100%', padding: '10px 14px' }}
                  placeholder="https://api.openai.com/v1"
                  defaultValue="https://api.openai.com/v1"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="ai-action-btn" onClick={prevStep}>Back</button>
                <button className="ai-action-btn active" onClick={nextStep}>
                  {apiKey ? 'Continue' : 'Skip for Now'}
                </button>
              </div>
            </div>
          )}

          {step === 'theme' && (
            <div style={{ padding: '40px' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Choose Your Theme</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.5 }}>
                Pick a look that feels right. You can change this anytime in Settings.
              </p>
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                {(['velocity-night', 'midnight-blue', 'graphite'] as const).map((theme) => {
                  const previewBg = theme === 'velocity-night' ? '#16161e' : theme === 'midnight-blue' ? '#111627' : '#1a1a1a';
                  const previewAccent = theme === 'velocity-night' ? '#c4a0ff' : theme === 'midnight-blue' ? '#7b9eff' : '#b0b0b0';
                  return (
                    <button
                      key={theme}
                      onClick={() => handleThemeChange(theme)}
                      style={{
                        flex: 1, borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                        border: selectedTheme === theme ? '2px solid var(--text-accent)' : '2px solid transparent',
                        transition: 'all 0.2s', background: 'transparent', padding: 0,
                      }}
                    >
                      <div style={{
                        height: 100, background: previewBg, padding: 16,
                        display: 'flex', flexDirection: 'column', gap: 6,
                        borderRadius: 10,
                      }}>
                        <div style={{ height: 6, width: '60%', background: previewAccent, borderRadius: 3 }} />
                        <div style={{ height: 4, width: '40%', background: 'rgba(255,255,255,0.1)', borderRadius: 2 }} />
                        <div style={{ height: 4, width: '80%', background: 'rgba(255,255,255,0.07)', borderRadius: 2 }} />
                        <div style={{ height: 4, width: '50%', background: 'rgba(255,255,255,0.07)', borderRadius: 2 }} />
                      </div>
                      <div style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {theme === 'velocity-night' ? 'Velocity Night' : theme === 'midnight-blue' ? 'Midnight Blue' : 'Graphite'}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Accent Color</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['violet', 'cyan', 'emerald', 'amber'] as const).map((accent) => {
                    const colorMap = { violet: '#c4a0ff', cyan: '#67e8f9', emerald: '#6ee7b7', amber: '#fbbf24' };
                    return (
                      <button
                        key={accent}
                        onClick={() => handleAccentChange(accent)}
                        style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: colorMap[accent],
                          border: selectedAccent === accent ? '3px solid var(--text-primary)' : '3px solid transparent',
                          cursor: 'pointer', transition: 'all 0.2s',
                          transform: selectedAccent === accent ? 'scale(1.15)' : 'scale(1)',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="ai-action-btn" onClick={prevStep}>Back</button>
                <button className="ai-action-btn active" onClick={nextStep}>Continue</button>
              </div>
            </div>
          )}

          {step === 'ready' && (
            <div style={{ textAlign: 'center', padding: '48px 40px 40px' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'var(--accent-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>You're All Set!</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto 32px' }}>
                {aiChoice === 'local'
                  ? 'Velocity Model is ready. Open a project and start coding with AI that runs entirely on your machine.'
                  : 'Your AI provider is configured. Open a project and start coding with cloud-powered intelligence.'}
              </p>
              <div style={{
                background: 'var(--bg-surface)', borderRadius: 12, padding: 20,
                border: '1px solid var(--border-primary)', marginBottom: 32, textAlign: 'left',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4Z"/><path d="M12 22v-4"/>
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Quick Tips</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  • <strong style={{ color: 'var(--text-secondary)' }}>⌘P</strong> — Quick file search<br/>
                  • <strong style={{ color: 'var(--text-secondary)' }}>⌘,</strong> — Open settings<br/>
                  • <strong style={{ color: 'var(--text-secondary)' }}>⌘S</strong> — Save file<br/>
                  • Select code and ask AI to explain, refactor, or edit it
                </div>
              </div>
              <button
                className="onboarding-btn"
                onClick={handleFinish}
                style={{ padding: '12px 40px', fontSize: 15 }}
              >
                Start Coding
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
