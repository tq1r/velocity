import { useState, useEffect, useCallback, useMemo } from 'react';
import { useVelocityStore } from '../state/store';
import { saveSettings } from '../lib/tauri';
import type { UserSettings } from '../types';
import { modelPresets, getCurrentPreset, getPresetById } from '../lib/modelPresets';
import { isDesktopApp, checkForUpdates } from '../lib/tauri';

const APP_VERSION = '0.1.0';

function UpdateCheck() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'current'>('idle');
  const [info, setInfo] = useState<{ version: string; url: string } | null>(null);

  const handleCheck = useCallback(async () => {
    if (!isDesktopApp) return;
    setStatus('checking');
    try {
      const result = await checkForUpdates(APP_VERSION);
      if (result.available) {
        setStatus('available');
        setInfo({ version: result.version, url: result.url });
      } else {
        setStatus('current');
      }
    } catch {
      setStatus('current');
    }
  }, []);

  if (!isDesktopApp) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {status === 'idle' && (
        <button className="ai-action-btn" onClick={handleCheck} style={{ fontSize: 11 }}>Check for Updates</button>
      )}
      {status === 'checking' && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Checking...</span>
      )}
      {status === 'available' && info && (
        <>
          <span style={{ fontSize: 11, color: 'var(--text-accent)' }}>v{info.version} available</span>
          <a href={info.url} target="_blank" rel="noreferrer" className="ai-action-btn active" style={{ fontSize: 11, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', padding: '4px 10px' }}>
            Download
          </a>
        </>
      )}
      {status === 'current' && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>v{APP_VERSION} is up to date</span>
      )}
    </div>
  );
}

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const store = useVelocityStore();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (store.settings) {
      setSettings({ ...store.settings });
    }
  }, [store.settings]);

  if (!settings) return null;

  const handleSave = async () => {
    if (!settings) return;
    try {
      const saved = await saveSettings(settings);
      store.setSettings(saved);
      document.documentElement.setAttribute('data-theme', saved.theme);
      document.documentElement.setAttribute('data-accent', saved.accent);
      document.documentElement.style.fontSize = `${saved.font_size}px`;
      document.documentElement.style.setProperty('--ui-scale', String(saved.ui_scale));
      if (!saved.animations) {
        document.documentElement.classList.add('no-animations');
      } else {
        document.documentElement.classList.remove('no-animations');
      }
      store.setStatusText(settings.ai.use_local_model ? 'Using Velocity Model (local)' : 'Settings saved');
      onClose();
    } catch (err) {
      store.setStatusText(`Failed to save settings: ${err}`);
    }
  };

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((s) => s ? { ...s, [key]: value } : s);
  };

  const updateAI = <K extends keyof UserSettings['ai']>(key: K, value: UserSettings['ai'][K]) => {
    setSettings((s) => s ? { ...s, ai: { ...s.ai, [key]: value } } : s);
  };

  const searchLower = searchQuery.toLowerCase().trim();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="settings-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              className="settings-search-input"
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          {(!searchLower || 'ai'.includes(searchLower) || 'model'.includes(searchLower) || 'local'.includes(searchLower) || 'provider'.includes(searchLower) || 'api'.includes(searchLower) || 'key'.includes(searchLower) || 'temperature'.includes(searchLower) || 'preset'.includes(searchLower)) && (
          <div className="settings-group">
            <div className="settings-group-title">AI Model</div>
            {(!searchLower || 'local'.includes(searchLower) || 'model'.includes(searchLower)) && (
            <div className="settings-row">
              <span className="settings-label">Use Local Model</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {settings.ai.use_local_model ? 'Velocity Model (offline)' : 'Cloud API'}
                </span>
                <input
                  type="checkbox"
                  checked={settings.ai.use_local_model}
                  onChange={(e) => updateAI('use_local_model', e.target.checked)}
                  style={{ accentColor: 'var(--text-accent)', width: 18, height: 18 }}
                />
              </label>
            </div>
            )}
            {!settings.ai.use_local_model && (
              <>
                {(!searchLower || 'preset'.includes(searchLower) || 'model'.includes(searchLower)) && (
                <div className="settings-row">
                  <span className="settings-label">Model Preset</span>
                  <select
                    className="settings-select"
                    value={getCurrentPreset(settings)?.id || '__custom__'}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id === '__custom__') return;
                      const preset = getPresetById(id);
                      if (!preset) return;
                      if (preset.tier === 'premium' && !store.isOwner && !store.premium?.premium) return;
                      updateAI('provider_name', preset.provider);
                      updateAI('api_base', preset.apiBase);
                      updateAI('model', preset.model);
                    }}
                  >
                    <optgroup label="── Free Models ──">
                      {modelPresets.filter(p => p.tier === 'free').map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.description}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="── Premium Models [PREMIUM] ──">
                      {modelPresets.filter(p => p.tier === 'premium').map(p => {
                        const locked = p.tier === 'premium' && !store.isOwner && !store.premium?.premium;
                        return (
                          <option key={p.id} value={p.id} disabled={locked}>
                            {locked ? '[LOCKED] ' : ''}{p.name} — {p.description}
                          </option>
                        );
                      })}
                    </optgroup>
                    <option value="__custom__">── Custom Configuration ──</option>
                  </select>
                </div>
                )}
                {(!searchLower || 'provider'.includes(searchLower)) && (
                <div className="settings-row">
                  <span className="settings-label">Provider</span>
                  <input className="settings-input" value={settings.ai.provider_name} onChange={(e) => updateAI('provider_name', e.target.value)} />
                </div>
                )}
                {(!searchLower || 'api'.includes(searchLower) || 'base'.includes(searchLower) || 'url'.includes(searchLower)) && (
                <div className="settings-row">
                  <span className="settings-label">API Base URL</span>
                  <input className="settings-input" value={settings.ai.api_base} onChange={(e) => updateAI('api_base', e.target.value)} />
                </div>
                )}
                {(!searchLower || 'model'.includes(searchLower)) && (
                <div className="settings-row">
                  <span className="settings-label">Model</span>
                  <input className="settings-input" value={settings.ai.model} onChange={(e) => updateAI('model', e.target.value)} />
                </div>
                )}
                {(!searchLower || 'api'.includes(searchLower) || 'key'.includes(searchLower)) && (
                <div className="settings-row">
                  <span className="settings-label">API Key</span>
                  <input className="settings-input" type="password" value={settings.ai.api_key || ''} onChange={(e) => updateAI('api_key', e.target.value || null)} placeholder={settings.ai.provider_name === 'github' ? 'Optional — uses GitHub token' : 'sk-...'} />
                </div>
                )}
                {(!searchLower || 'temperature'.includes(searchLower)) && (
                <div className="settings-row">
                  <span className="settings-label">Temperature</span>
                  <input className="settings-input" type="number" min={0} max={2} step={0.1} value={settings.ai.temperature} onChange={(e) => updateAI('temperature', parseFloat(e.target.value) || 0.2)} />
                </div>
                )}
              </>
            )}
            {settings.ai.use_local_model && (
              <div className="settings-row">
                <span className="settings-label">Status</span>
                <span style={{ fontSize: 12, color: 'var(--text-accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h.01"/><path d="M15 9h.01"/><path d="M9 15h6"/><path d="M9 12h6"/>
                  </svg>
                  Local — runs on your machine
                </span>
              </div>
            )}
          </div>
          )}
          {(!searchLower || 'appearance'.includes(searchLower) || 'theme'.includes(searchLower) || 'accent'.includes(searchLower) || 'font'.includes(searchLower) || 'scale'.includes(searchLower) || 'animation'.includes(searchLower)) && (
          <div className="settings-group">
            <div className="settings-group-title">Appearance</div>
            {(!searchLower || 'theme'.includes(searchLower)) && (
            <div className="settings-row">
              <span className="settings-label">Theme</span>
              <select className="settings-select" value={settings.theme} onChange={(e) => { update('theme', e.target.value as UserSettings['theme']); document.documentElement.setAttribute('data-theme', e.target.value); }}>
                <option value="velocity-night">Velocity Night</option>
                <option value="midnight-blue">Midnight Blue</option>
                <option value="graphite">Graphite</option>
              </select>
            </div>
            )}
            {(!searchLower || 'accent'.includes(searchLower) || 'color'.includes(searchLower)) && (
            <div className="settings-row">
              <span className="settings-label">Accent Color</span>
              <select className="settings-select" value={settings.accent} onChange={(e) => { update('accent', e.target.value as UserSettings['accent']); document.documentElement.setAttribute('data-accent', e.target.value); }}>
                <option value="violet">Violet</option>
                <option value="cyan">Cyan</option>
                <option value="emerald">Emerald</option>
                <option value="amber">Amber</option>
              </select>
            </div>
            )}
            {(!searchLower || 'font'.includes(searchLower) || 'size'.includes(searchLower)) && (
            <div className="settings-row">
              <span className="settings-label">Font Size</span>
              <input className="settings-input" type="number" min={10} max={32} value={settings.font_size} onChange={(e) => update('font_size', parseInt(e.target.value) || 14)} />
            </div>
            )}
            {(!searchLower || 'scale'.includes(searchLower) || 'ui'.includes(searchLower)) && (
            <div className="settings-row">
              <span className="settings-label">UI Scale</span>
              <input className="settings-input" type="number" min={0.8} max={1.5} step={0.1} value={settings.ui_scale} onChange={(e) => update('ui_scale', parseFloat(e.target.value) || 1)} />
            </div>
            )}
            {(!searchLower || 'animation'.includes(searchLower)) && (
            <div className="settings-row">
              <span className="settings-label">Animations</span>
              <input type="checkbox" checked={settings.animations} onChange={(e) => update('animations', e.target.checked)} style={{ accentColor: 'var(--text-accent)' }} />
            </div>
            )}
          </div>
          )}
          {(!searchLower || 'profile'.includes(searchLower) || 'name'.includes(searchLower) || 'startup'.includes(searchLower) || 'account'.includes(searchLower) || 'limit'.includes(searchLower) || 'daily'.includes(searchLower)) && (
          <div className="settings-group">
            <div className="settings-group-title">Profile</div>
            {(!searchLower || 'name'.includes(searchLower) || 'display'.includes(searchLower)) && (
            <div className="settings-row">
              <span className="settings-label">Display Name</span>
              <input className="settings-input" value={settings.profile_name} onChange={(e) => update('profile_name', e.target.value)} />
            </div>
            )}
            {(!searchLower || 'startup'.includes(searchLower) || 'preset'.includes(searchLower)) && (
            <div className="settings-row">
              <span className="settings-label">Startup Preset</span>
              <select className="settings-select" value={settings.startup_preset} onChange={(e) => update('startup_preset', e.target.value as UserSettings['startup_preset'])}>
                <option value="ai-engineer">AI Engineer</option>
                <option value="minimal">Minimal</option>
                <option value="review-mode">Review Mode</option>
              </select>
            </div>
            )}
            {store.user && (!searchLower || 'account'.includes(searchLower) || 'premium'.includes(searchLower) || 'owner'.includes(searchLower)) && (
            <div className="settings-row">
              <span className="settings-label">Account</span>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                {store.isOwner ? (
                  <><span className="quota-badge" style={{ color: 'var(--text-accent)' }}>OWNER</span> unlimited unrestricted</>
                ) : store.premium?.premium ? (
                  <><span className="quota-badge" style={{ color: 'var(--text-accent)' }}>PREMIUM</span> {store.premium.tier}</>
                ) : (
                  <><span className="quota-badge" style={{ color: 'var(--text-muted)' }}>FREE</span> {settings.daily_ai_limit}/day</>
                )}
              </span>
            </div>
            )}
            {(!searchLower || 'limit'.includes(searchLower) || 'daily'.includes(searchLower)) && (
            <div className="settings-row">
              <span className="settings-label">Daily AI Limit</span>
              <input className="settings-input" type="number" min={0} value={settings.daily_ai_limit} onChange={(e) => update('daily_ai_limit', parseInt(e.target.value) || 0)} disabled={store.isOwner} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{store.isOwner ? 'Owner bypasses limits' : '0 = unlimited'}</span>
            </div>
            )}
          </div>
          )}
          {searchQuery && (
          <div className="settings-group" style={{ opacity: 0.7 }}>
            <div className="settings-group-title">Tips</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Try searching: "theme", "font", "api", "model", "key", "temperature", "account", "limit"
            </p>
          </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
            <div>
              <UpdateCheck />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ai-action-btn" onClick={onClose}>Cancel</button>
              <button className="ai-action-btn active" onClick={handleSave}>Save Settings</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
