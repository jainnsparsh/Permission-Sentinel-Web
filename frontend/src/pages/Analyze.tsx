import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileCode, 
  FileText, 
  Sliders, 
  Sparkles, 
  AlertCircle, 
  ArrowRight,
  Shield
} from 'lucide-react';
import { api } from '../services/api';

const DEFAULT_PURPOSES = [
  'Flashlight / Utility',
  'Calculator',
  'Navigation / Maps',
  'Social Networking',
  'Health & Fitness',
  'Photo & Video Editor',
  'Banking & Finance',
  'Messaging / Chat',
  'Audio & Music Player',
  'File Manager',
  'Weather',
  'Generic / Other'
];

interface DemoAppMeta {
  app_name: string;
  package_name: string;
  purpose: string;
  expected_risk_band: string;
  permission_count: number;
}

export const Analyze: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'upload' | 'preset' | 'json' | 'manual'>('upload');
  
  // Shared fields
  const [purpose, setPurpose] = useState<string>('Flashlight / Utility');
  const [purposesList, setPurposesList] = useState<string[]>(DEFAULT_PURPOSES);
  const [purposeSource, setPurposeSource] = useState<string>('user-selected');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mode 1: File Upload
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Mode 2: Preset Demo Apps
  const [demoApps, setDemoApps] = useState<DemoAppMeta[]>([]);
  const [selectedDemoIndex, setSelectedDemoIndex] = useState<number>(0);

  // Mode 3: JSON Paste
  const [jsonInput, setJsonInput] = useState<string>(`{
  "app_name": "Suspicious Torch",
  "package_name": "com.flashlight.brighttorch",
  "version": "1.0.0",
  "target_sdk": "34",
  "permissions": [
    "android.permission.CAMERA",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.READ_CONTACTS",
    "android.permission.RECORD_AUDIO",
    "android.permission.INTERNET"
  ]
}`);

  // Mode 4: Manual Form
  const [manualAppName, setManualAppName] = useState<string>('My Sample App');
  const [manualPkgName, setManualPkgName] = useState<string>('com.example.myapp');
  const [manualPermissionsText, setManualPermissionsText] = useState<string>(
    'android.permission.INTERNET\nandroid.permission.ACCESS_FINE_LOCATION\nandroid.permission.CAMERA'
  );

  useEffect(() => {
    // Fetch purposes
    api.purposes()
      .then(res => {
        if (res.purposes && res.purposes.length > 0) {
          setPurposesList(res.purposes);
          setPurpose(res.purposes[0]);
        }
      })
      .catch(() => {});

    // Fetch demo apps
    api.demoApps()
      .then(res => {
        if (res.apps && Array.isArray(res.apps)) {
          setDemoApps(res.apps as DemoAppMeta[]);
        }
      })
      .catch(() => {});
  }, []);

  // Dropzone setup
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    maxFiles: 1,
    accept: {
      'application/vnd.android.package-archive': ['.apk'],
      'application/xml': ['.xml'],
      'text/xml': ['.xml'],
      'application/json': ['.json'],
      'text/csv': ['.csv'],
    },
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setUploadedFile(acceptedFiles[0]);
        setErrorMessage(null);
      }
    },
  });

  const handleFileUpload = async () => {
    if (!uploadedFile) {
      setErrorMessage('Please select an APK, Manifest XML, JSON, or CSV file.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const res = await api.analyzeUpload(uploadedFile, purpose, purposeSource);
      if (res && res.id) {
        navigate(`/app/${res.id}`);
      } else {
        throw new Error('Analysis completed but no ID returned');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload analysis failed';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePresetSelect = async () => {
    if (demoApps.length === 0) return;
    const selected = demoApps[selectedDemoIndex];

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      // Run batch analysis of demo apps or analyze single
      const res = await api.analyzeDemoApps();
      if (res && res.results && res.results.length > 0) {
        const found = (res.results as { id: string; app_name: string }[]).find(
          r => r.app_name === selected.app_name
        ) || (res.results[0] as { id: string });
        navigate(`/app/${found.id}`);
      } else {
        throw new Error('Could not analyze demo app');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Preset analysis failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJsonSubmit = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const parsed = JSON.parse(jsonInput);
      
      const permissions: string[] = Array.isArray(parsed.permissions) ? parsed.permissions : [];
      const appName = parsed.app_name || parsed.name || 'Unnamed App';
      const packageName = parsed.package_name || parsed.package || 'com.example.unnamed';

      const res = await api.analyzeReport({
        app_name: appName,
        package_name: packageName,
        purpose: purpose,
        purpose_source: purposeSource,
        permissions: permissions,
        version: parsed.version || '1.0.0',
        target_sdk: parsed.target_sdk || '34',
        description: parsed.description,
      }) as { id: string };

      if (res && res.id) {
        navigate(`/app/${res.id}`);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid JSON format or analysis error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      
      const permissions = manualPermissionsText
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      if (permissions.length === 0) {
        setErrorMessage('Please specify at least one permission to analyze.');
        setIsSubmitting(false);
        return;
      }

      const res = await api.analyzeReport({
        app_name: manualAppName.trim() || 'Manual Audit App',
        package_name: manualPkgName.trim() || 'com.custom.app',
        purpose: purpose,
        purpose_source: purposeSource,
        permissions: permissions,
        version: '1.0.0',
        target_sdk: '34',
      }) as { id: string };

      if (res && res.id) {
        navigate(`/app/${res.id}`);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Manual analysis failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div className="page-header">
        <h2>Analyze Application Permissions</h2>
        <p>Choose an ingestion method to evaluate excessive permissions against declared app purpose</p>
      </div>

      {errorMessage && (
        <div className="notice error">
          <AlertCircle size={18} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <Upload size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
          File Upload (APK, XML, JSON, CSV)
        </button>
        <button 
          className={`tab ${activeTab === 'preset' ? 'active' : ''}`}
          onClick={() => setActiveTab('preset')}
        >
          <Sparkles size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
          Benchmark Demo Fixtures
        </button>
        <button 
          className={`tab ${activeTab === 'json' ? 'active' : ''}`}
          onClick={() => setActiveTab('json')}
        >
          <FileCode size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
          Paste JSON Report
        </button>
        <button 
          className={`tab ${activeTab === 'manual' ? 'active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          <Sliders size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
          Manual Permission Form
        </button>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        {/* Declared Purpose & Context Section (Common for all tabs) */}
        <div style={{ paddingBottom: '20px', marginBottom: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Shield size={18} style={{ color: 'var(--accent-indigo)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>App Declared Purpose & Verification Context</h3>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Declared App Purpose / Category</label>
              <select 
                className="form-select"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
              >
                {purposesList.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Permissions are evaluated against the functional necessity of this declared purpose.
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Purpose Origin</label>
              <select 
                className="form-select"
                value={purposeSource}
                onChange={e => setPurposeSource(e.target.value)}
              >
                <option value="user-selected">User Selected</option>
                <option value="store-declared">Google Play Store Category</option>
                <option value="manifest-inferred">Manifest Inferred</option>
              </select>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Ground truth label provenance
              </div>
            </div>
          </div>
        </div>

        {/* Tab 1: File Upload */}
        {activeTab === 'upload' && (
          <div>
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              <div className="dropzone-icon">
                <Upload size={28} />
              </div>
              <h3>Drag & drop your file here, or click to browse</h3>
              <p>Supports AndroidManifest.xml, .APK binaries, permission report .JSON, or .CSV exports (Max 100MB)</p>
            </div>

            {uploadedFile && (
              <div style={{ 
                marginTop: '16px', 
                padding: '14px 18px', 
                background: 'var(--bg-secondary)', 
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid var(--border-accent)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileText size={20} style={{ color: 'var(--accent-indigo)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{uploadedFile.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {(uploadedFile.size / 1024).toFixed(1)} KB · {uploadedFile.type || 'Custom format'}
                    </div>
                  </div>
                </div>
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => setUploadedFile(null)}
                >
                  Change
                </button>
              </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-primary"
                onClick={handleFileUpload}
                disabled={!uploadedFile || isSubmitting}
              >
                {isSubmitting ? 'Analyzing File...' : 'Start Audit'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Benchmark Demo Fixtures */}
        {activeTab === 'preset' && (
          <div>
            <div className="notice info" style={{ marginBottom: '18px' }}>
              <Sparkles size={18} />
              <div>
                Select from 8 curated real-world application test fixtures with ground truth risk ratings.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {demoApps.map((app, idx) => {
                const isSelected = selectedDemoIndex === idx;
                const band = app.expected_risk_band || 'Medium';
                return (
                  <div 
                    key={idx}
                    onClick={() => {
                      setSelectedDemoIndex(idx);
                      setPurpose(app.purpose);
                    }}
                    style={{
                      background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-secondary)',
                      border: isSelected ? '2px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem', color: isSelected ? 'var(--accent-indigo)' : 'var(--text-primary)' }}>
                        {app.app_name}
                      </span>
                      <span className={`risk-badge ${band.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                        {band}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '8px' }}>
                      {app.package_name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>Purpose: <strong>{app.purpose}</strong></span>
                      <span>{app.permission_count} perms</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-primary"
                onClick={handlePresetSelect}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Evaluating Benchmark...' : 'Audit Selected Preset'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Paste JSON */}
        {activeTab === 'json' && (
          <div>
            <div className="form-group">
              <label className="form-label">Permissions JSON Payload</label>
              <textarea 
                className="form-textarea"
                rows={12}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-primary"
                onClick={handleJsonSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Parsing & Scoring...' : 'Analyze JSON Report'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Manual Form */}
        {activeTab === 'manual' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Application Name</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={manualAppName}
                  onChange={e => setManualAppName(e.target.value)}
                  placeholder="e.g. My Secure App"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Package Identifier</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={manualPkgName}
                  onChange={e => setManualPkgName(e.target.value)}
                  placeholder="e.g. com.company.app"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Permissions Requested (One per line)</label>
              <textarea 
                className="form-textarea"
                rows={8}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                value={manualPermissionsText}
                onChange={e => setManualPermissionsText(e.target.value)}
                placeholder="android.permission.INTERNET&#10;android.permission.CAMERA"
              />
            </div>

            {/* Quick add popular dangerous permissions */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Quick Add High-Sensitivity Permissions:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  'android.permission.READ_SMS',
                  'android.permission.READ_CONTACTS',
                  'android.permission.ACCESS_FINE_LOCATION',
                  'android.permission.RECORD_AUDIO',
                  'android.permission.CAMERA',
                  'android.permission.READ_CALL_LOG',
                  'android.permission.WRITE_EXTERNAL_STORAGE',
                ].map(p => (
                  <button
                    key={p}
                    type="button"
                    className="chip"
                    style={{ cursor: 'pointer', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
                    onClick={() => {
                      if (!manualPermissionsText.includes(p)) {
                        setManualPermissionsText(prev => prev.trim() + '\n' + p);
                      }
                    }}
                  >
                    + {p.replace('android.permission.', '')}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-primary"
                onClick={handleManualSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Evaluating...' : 'Run Audit'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analyze;
