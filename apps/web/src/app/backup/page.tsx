'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { api, BackupSummary, BackupEngineConfig } from '@/lib/api';
import {
  Database,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  HardDrive,
  Users,
  Boxes,
  Landmark,
  Receipt,
  ShoppingCart,
  BookOpen,
  Cloud,
  Check,
  CloudOff,
  FolderOpen,
  Clock,
  Settings2,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';

export default function BackupPage() {
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Engine state
  const [config, setConfig] = useState<BackupEngineConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [backingUpNow, setBackingUpNow] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [drivePreview, setDrivePreview] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [restoringDrive, setRestoringDrive] = useState(false);
  const [restoringLocal, setRestoringLocal] = useState(false);

  // Form states for config
  const [schedule, setSchedule] = useState<'15m' | '30m' | '1h' | 'daily' | 'realtime'>('30m');
  const [dailyTime, setDailyTime] = useState('20:00');
  const [localBackupDir, setLocalBackupDir] = useState('');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [detectedCloudFolders, setDetectedCloudFolders] = useState<
    Array<{ id: string; name: string; path: string; exists: boolean }>
  >([]);

  // Manual Import / Export state (preserved)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<any | null>(null);
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('overwrite');
  const [importing, setImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    stats?: any;
  } | null>(null);

  const fetchSummary = async () => {
    try {
      setLoadingSummary(true);
      const data = await api.getBackupSummary();
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to load backup summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchConfig = async () => {
    try {
      setLoadingConfig(true);
      const cfg = await api.getBackupConfig();
      setConfig(cfg);
      setSchedule(cfg.schedule || '30m');
      setDailyTime(cfg.dailyTime || '20:00');
      setLocalBackupDir(cfg.localBackupDir || '');
      setAutoBackupEnabled(cfg.enabled !== undefined ? cfg.enabled : true);

      if (cfg.gdriveConnected) {
        loadDrivePreview();
      }
    } catch (err: any) {
      console.error('Failed to load backup config:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadDrivePreview = async () => {
    try {
      setLoadingPreview(true);
      const res = await api.previewGoogleDriveBackup();
      setDrivePreview(res.preview);
    } catch (err) {
      console.error('Failed to preview Drive backup:', err);
      setDrivePreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchConfig();
    api
      .detectCloudFolders()
      .then((res) => {
        if (res && res.detected) setDetectedCloudFolders(res.detected);
      })
      .catch(() => {});

    // Listen for OAuth completion message if opened via popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'gdrive-connected') {
        fetchConfig();
        setStatusMessage({
          type: 'success',
          text: 'Google Drive connected successfully! Background auto-sync is now active.',
        });
      }
    };
    const handleFocus = () => {
      fetchConfig();
    };
    window.addEventListener('message', handleMessage);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Save Settings
  const handleSaveSettings = async () => {
    try {
      setSavingConfig(true);
      setStatusMessage(null);
      const res = await api.updateBackupConfig({
        enabled: autoBackupEnabled,
        schedule,
        dailyTime,
        localBackupDir,
      });
      setConfig(res.config);
      setStatusMessage({
        type: 'success',
        text: 'Backup automation settings saved successfully!',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to update backup settings.',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  // Browse local folder dialog
  const handleBrowseFolder = async () => {
    try {
      const res = await api.selectLocalBackupFolder();
      if (res.selectedPath) {
        setLocalBackupDir(res.selectedPath);
        if (config) {
          setConfig({ ...config, localBackupDir: res.selectedPath });
        }
        setStatusMessage({
          type: 'success',
          text: `Backup folder set to: ${res.selectedPath}`,
        });
      }
    } catch (err: any) {
      console.error('Browse folder error:', err);
    }
  };

  // 1-Click Cloud Folder Preset (OneDrive, Google Drive, etc.)
  const handleSelectCloudPreset = async (folderPath: string) => {
    try {
      const res = await api.setBackupFolder(folderPath);
      if (res.success) {
        setLocalBackupDir(res.localBackupDir);
        if (config) {
          setConfig({ ...config, localBackupDir: res.localBackupDir });
        }
        setStatusMessage({
          type: 'success',
          text: `Cloud sync destination set: ${res.localBackupDir}`,
        });
        // Immediately run backup to populate destination
        api.runManualBackup().then(() => {
          fetchConfig();
          fetchSummary();
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to set backup folder.',
      });
    }
  };

  // Run Backup Now
  const handleRunBackupNow = async () => {
    try {
      setBackingUpNow(true);
      setStatusMessage(null);
      const res = await api.runManualBackup();
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Master container updated successfully! (${res.totalRecords} records protected at ${res.filePath})`,
        });
        fetchConfig();
        fetchSummary();
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || 'Backup could not be completed.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error executing backup.',
      });
    } finally {
      setBackingUpNow(false);
    }
  };

  // Google Drive Connect — credentials are read from .env on the server
  const handleConnectGoogleDrive = async () => {
    try {
      const redirectUri = `${window.location.origin}/redirect`;
      const { authUrl } = await api.getGoogleDriveAuthUrl(redirectUri);
      // Open in centered popup window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        authUrl,
        'GoogleDriveAuth',
        `width=${width},height=${height},top=${top},left=${left}`
      );
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.location.href = authUrl;
      }

      // Start automatic polling to detect completion when user authorizes in external browser
      let attempts = 0;
      const pollTimer = setInterval(async () => {
        attempts++;
        if (attempts > 60) { // Poll for up to 2.5 minutes
          clearInterval(pollTimer);
          return;
        }
        try {
          const cfg = await api.getBackupConfig();
          if (cfg.gdriveConnected) {
            clearInterval(pollTimer);
            setConfig(cfg);
            loadDrivePreview();
            setStatusMessage({
              type: 'success',
              text: `Google Drive connected successfully (${cfg.gdriveUserEmail || 'Linked'})! Background auto-sync is now active.`,
            });
          }
        } catch {
          // ignore transient poll errors
        }
      }, 2500);
    } catch (err: any) {
      setStatusMessage({
        type: 'info',
        text: 'Google API credentials not configured. TIP: You can sync directly to Google Drive or OneDrive with ZERO setup by choosing your cloud folder in "Cloud & Local Folder Sync" above!',
      });
    }
  };

  // Google Drive Disconnect
  const handleDisconnectGoogleDrive = async () => {
    if (!confirm('Are you sure you want to disconnect Google Drive cloud sync?')) return;
    try {
      await api.disconnectGoogleDrive();
      fetchConfig();
      setDrivePreview(null);
      setStatusMessage({
        type: 'info',
        text: 'Google Drive cloud backup has been disconnected.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to disconnect Google Drive.',
      });
    }
  };

  // Sync to Drive Now
  const handleSyncDriveNow = async () => {
    try {
      setSyncingDrive(true);
      setStatusMessage(null);
      const res = await api.syncGoogleDriveNow();
      fetchConfig();
      loadDrivePreview();
      setStatusMessage({
        type: res.status === 'synced' ? 'success' : 'info',
        text: res.message || 'Google Drive sync complete.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Drive sync failed.',
      });
    } finally {
      setSyncingDrive(false);
    }
  };

  // 1-Click Restore from Google Drive
  const handleRestoreFromDrive = async () => {
    const confirmed = confirm(
      '⚠️ ATTENTION: RESTORE SYSTEM FROM GOOGLE DRIVE\n\nThis will completely restore your database with the master container from Google Drive. Day 1 to latest records will be fully restored.\n\nAre you sure you want to proceed?'
    );
    if (!confirmed) return;

    try {
      setRestoringDrive(true);
      setStatusMessage(null);
      const res = await api.restoreFromGoogleDrive();
      fetchSummary();
      setStatusMessage({
        type: 'success',
        text: `🎉 Disaster Recovery Complete! All records restored from Google Drive successfully.`,
        stats: res.restoredStats,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to restore from Google Drive.',
      });
    } finally {
      setRestoringDrive(false);
    }
  };

  // 1-Click Restore from Local Master File
  const handleRestoreFromLocalMaster = async () => {
    const confirmed = confirm(
      '⚠️ RESTORE FROM LOCAL MASTER CONTAINER\n\nThis will restore the system from the local tally_master_backup.json file.\n\nAre you sure you want to proceed?'
    );
    if (!confirmed) return;

    try {
      setRestoringLocal(true);
      setStatusMessage(null);
      const res = await api.restoreFromLocalMaster();
      fetchSummary();
      setStatusMessage({
        type: 'success',
        text: `🎉 System restored from local master container!`,
        stats: res.restoredStats,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to restore from local container.',
      });
    } finally {
      setRestoringLocal(false);
    }
  };

  // 1. Export Full System JSON Backup (Manual)
  const handleExportBackup = async () => {
    try {
      setExporting(true);
      setStatusMessage(null);
      const backupData = await api.exportBackupData();
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `tally_full_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: `🎉 Full system backup exported successfully! Save "${link.download}" on a USB Drive or cloud storage.`,
      });
    } catch (err: any) {
      console.error('Export failed:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to export backup data.',
      });
    } finally {
      setExporting(false);
    }
  };

  // 2. File Selection & Parsing (Manual)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || !parsed.data) {
          throw new Error('Selected file is not a valid Tally backup JSON file (missing data payload).');
        }
        setParsedBackup(parsed);
      } catch (err: any) {
        console.error('Parse error:', err);
        setParsedBackup(null);
        setStatusMessage({
          type: 'error',
          text: `Invalid backup file: ${err.message}`,
        });
      }
    };
    reader.readAsText(file);
  };

  // 3. Manual Import Execution
  const handleExecuteRestore = async () => {
    if (!parsedBackup) return;

    const confirmText =
      importMode === 'overwrite'
        ? '⚠️ WARNING: You have selected OVERWRITE CLEAN RESTORE mode. This will replace all existing local database data with the backup file data. Are you sure you want to proceed?'
        : 'Confirm importing and merging backup data into existing system database?';

    if (!confirm(confirmText)) return;

    try {
      setImporting(true);
      setStatusMessage(null);
      const res = await api.importBackupData(parsedBackup, importMode);
      setStatusMessage({
        type: 'success',
        text: `🎉 ${res.message || 'Restore completed successfully!'}`,
        stats: res.stats,
      });
      setSelectedFile(null);
      setParsedBackup(null);
      fetchSummary();
    } catch (err: any) {
      console.error('Restore error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to import backup data.',
      });
    } finally {
      setImporting(false);
    }
  };

  // CSV Exporters
  const handleExportVendorsCSV = async () => {
    try {
      const data = await api.getVendors();
      const csv = [
        ['ID', 'Name', 'Phone', 'Email', 'GSTIN', 'Address', 'Balance'],
        ...data.map((v: any) => [v.id, v.name, v.phone || '', v.email || '', v.gstin || '', v.address || '', v.balance || 0]),
      ].map((e: any[]) => e.map((val: any) => `"${val}"`).join(',')).join('\n');
      downloadBlob(csv, `vendors_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to export vendors' });
    }
  };

  const handleExportItemsCSV = async () => {
    try {
      const data = await api.getItems();
      const csv = [
        ['ID', 'Name', 'SKU', 'HSN Code', 'Purchase Price', 'Selling Price', 'Tax Rate %'],
        ...data.map((i: any) => [i.id, i.name, i.sku || '', i.hsnCode || '', i.purchasePrice || 0, i.sellingPrice || 0, i.taxRate || 18]),
      ].map((e: any[]) => e.map((val: any) => `"${val}"`).join(',')).join('\n');
      downloadBlob(csv, `inventory_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to export inventory' });
    }
  };

  const handleExportInvoicesCSV = async () => {
    try {
      const data = await api.getInvoices();
      const csv = [
        ['Invoice Number', 'Date', 'Customer Name', 'Phone', 'Payment Mode', 'Subtotal', 'Tax Amount', 'Total Amount', 'Status'],
        ...data.map((i: any) => [
          i.invoiceNumber,
          new Date(i.invoiceDate).toLocaleDateString(),
          i.customerName || '',
          i.customerPhone || '',
          i.paymentMode || '',
          i.subtotal || 0,
          i.taxAmount || 0,
          i.totalAmount || 0,
          i.status || '',
        ]),
      ].map((e: any[]) => e.map((val: any) => `"${val}"`).join(',')).join('\n');
      downloadBlob(csv, `invoices_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to export invoices' });
    }
  };

  const handleExportBankingCSV = async () => {
    try {
      const data: any = await api.getBankAccounts();
      const accountsList = Array.isArray(data) ? data : data.accounts || [];
      const csv = [
        ['Account Name', 'Type', 'Account Number', 'IFSC', 'Branch', 'Current Balance'],
        ...accountsList.map((b: any) => [b.accountName, b.accountType || 'BANK', b.accountNumber || '', b.ifscCode || '', b.branch || '', b.currentBalance || 0]),
      ].map((e: any[]) => e.map((val: any) => `"${val}"`).join(',')).join('\n');
      downloadBlob(csv, `banking_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to export banking' });
    }
  };

  const downloadBlob = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-tally-bg text-white">
      <Header title="Automated Backup & Cloud Disaster Recovery" />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* TOP STATUS NOTIFICATION BANNER */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : statusMessage.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-brand-500/10 border-brand-500/30 text-brand-400'
            }`}
          >
            {statusMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            {statusMessage.type === 'error' && <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            {statusMessage.type === 'info' && <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            <div className="flex-1 text-sm">
              <p className="font-semibold">{statusMessage.text}</p>
              {statusMessage.stats && (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-tally-bg/40 p-2.5 rounded-lg border border-tally-border">
                  <div>Vendors: {statusMessage.stats.vendors}</div>
                  <div>Inventory SKUs: {statusMessage.stats.items}</div>
                  <div>Invoices: {statusMessage.stats.invoices}</div>
                  <div>Bank Accounts: {statusMessage.stats.bankAccounts}</div>
                  <div>Purchases: {statusMessage.stats.purchases}</div>
                  <div>Vouchers: {statusMessage.stats.vouchers}</div>
                  <div>Journal: {statusMessage.stats.journalEntries}</div>
                  <div>Settings: {statusMessage.stats.companySettings}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── COMMAND CENTER HERO: 2 CRITICAL PILLARS ──────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pillar 1: Single Master Container */}
          <div className="glass-card rounded-2xl p-6 border border-tally-border bg-gradient-to-b from-emerald-500/5 to-transparent relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-500/15 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <Database className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Master Container
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Master Container (.json & .db)</h3>
              <p className="text-xs text-tally-textMuted mb-4">
                Contains 100% full business data (Invoices, Purchases, Inventory, Vendors, Banks & Settings) in a single updated container.
              </p>
              <div className="space-y-1.5 text-xs text-gray-300 bg-tally-bg/50 p-3 rounded-xl border border-tally-border font-mono">
                <div className="flex justify-between">
                  <span className="text-tally-textMuted">Filename:</span>
                  <span className="text-white font-bold">tally_master_backup.json</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tally-textMuted">Protected Records:</span>
                  <span className="text-emerald-400 font-bold">{summary?.totalRecords || 0} records</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tally-textMuted">Last Updated:</span>
                  <span>{config?.lastBackupAt ? new Date(config.lastBackupAt).toLocaleTimeString() : 'Never'}</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleRunBackupNow}
              disabled={backingUpNow}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-tally-bg font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${backingUpNow ? 'animate-spin' : ''}`} />
              <span>{backingUpNow ? 'Updating Master File...' : 'Update Master Backup Now'}</span>
            </button>
          </div>

          {/* Pillar 2: Cloud & Local Folder Sync */}
          <div className="glass-card rounded-2xl p-6 border border-tally-border bg-gradient-to-b from-brand-500/5 to-transparent relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-brand-500/15 text-brand-400 rounded-xl border border-brand-500/20">
                  <HardDrive className="w-6 h-6" />
                </div>
                {config?.localBackupDir?.toLowerCase().includes('onedrive') ? (
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30 flex items-center gap-1">
                    <Cloud className="w-3 h-3" /> OneDrive Sync Active
                  </span>
                ) : config?.localBackupDir?.toLowerCase().includes('google drive') ||
                  config?.localBackupDir?.toLowerCase().includes('my drive') ? (
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                    <Cloud className="w-3 h-3" /> Google Drive Sync Active
                  </span>
                ) : (
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30">
                    💾 Local / USB Storage
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Cloud & Local Folder Sync</h3>
              <p className="text-xs text-tally-textMuted mb-3">
                Zero-setup cloud backup! Backs up continuously to your Google Drive, OneDrive, or any chosen folder/USB.
              </p>
              <div className="space-y-1.5 text-xs text-gray-300 bg-tally-bg/50 p-3 rounded-xl border border-tally-border font-mono">
                <div className="text-[11px] text-tally-textMuted">Backup Destination:</div>
                <div className="truncate text-white text-xs font-semibold" title={config?.localBackupDir}>
                  {config?.localBackupDir || 'Loading path...'}
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-tally-textMuted">Schedule:</span>
                  <span className="text-brand-400 font-bold uppercase">{config?.schedule || '30m'}</span>
                </div>
              </div>

              {/* 1-Click Detected Cloud Presets */}
              {detectedCloudFolders.length > 0 && (
                <div className="mt-3 pt-2 border-t border-tally-border/40 space-y-1.5">
                  <div className="text-[10px] text-tally-textMuted uppercase font-bold tracking-wider">
                    Quick Cloud Connect:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detectedCloudFolders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleSelectCloudPreset(f.path)}
                        className={`text-[11px] font-medium py-1 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          config?.localBackupDir === f.path
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                            : 'bg-tally-bg hover:bg-tally-cardHover text-gray-300 border-tally-border'
                        }`}
                        title={f.path}
                      >
                        <Cloud className="w-3 h-3 text-cyan-400" />
                        <span>{f.name.replace(' (Cloud)', '').replace(' (Local Disk)', '')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={handleBrowseFolder}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Browse Folder / USB</span>
              </button>
              <button
                onClick={handleRestoreFromLocalMaster}
                disabled={restoringLocal}
                title="Restore from this destination"
                className="flex items-center justify-center gap-1 py-2.5 px-3 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold rounded-xl border border-red-500/30 transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── DISASTER RECOVERY RESTORE CENTER (FOR CRASH RECOVERY) ─────────── */}
        <div className="glass-card rounded-2xl p-6 border border-emerald-500/30 bg-emerald-500/5 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-tally-border/60 pb-5 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Disaster Recovery & 1-Click Restore</h2>
                <p className="text-xs text-tally-textMuted">
                  If your PC crashes or you install this software on a new laptop, restore 100% of your business data in 1-Click!
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Option A: Restore from Designated Cloud / Backup Folder */}
            <div className="p-5 rounded-xl border border-brand-500/30 bg-tally-bg/70 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-brand-400 font-bold text-sm">
                    <HardDrive className="w-5 h-5" />
                    <span>Restore from Active Backup Destination</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-500/20 text-brand-300">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed mb-4">
                  Restores complete business records directly from your active Google Drive, OneDrive, or local backup directory:
                  <br />
                  <span className="text-white font-mono text-[11px] block mt-1 truncate">
                    {config?.localBackupDir || 'Configured directory'}
                  </span>
                </p>

                <div className="p-3 rounded-lg bg-brand-950/30 border border-brand-500/20 text-xs font-mono space-y-1 mb-4">
                  <div className="text-brand-300 font-bold truncate">File: tally_master_backup.json</div>
                  <div className="text-gray-400">
                    Protected Records: {config?.lastBackupRecords || summary?.totalRecords || 0} | Last Updated:{' '}
                    {config?.lastBackupAt ? new Date(config.lastBackupAt).toLocaleString() : 'Never'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleRestoreFromLocalMaster}
                disabled={restoringLocal}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-40"
              >
                <Upload className="w-4 h-4" />
                <span>{restoringLocal ? 'Restoring System Data...' : 'Restore from Active Backup Destination (1-Click)'}</span>
              </button>
            </div>

            {/* Option B: Manual Backup File Restore */}
            <div className="p-5 rounded-xl border border-emerald-500/30 bg-tally-bg/70 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <Database className="w-5 h-5" />
                    <span>Restore from Any Backup File (.json)</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Portable File
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed mb-4">
                  Have a backup file on a pendrive, downloaded from Google Drive, or shared on WhatsApp? Select it below in the &ldquo;Data Import &amp; System Restore&rdquo; section to restore.
                </p>
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-xs text-gray-300 space-y-1 mb-4">
                  <div className="text-emerald-300 font-bold">✓ Universal JSON Restore Support</div>
                  <div className="text-gray-400">Works across all computers, laptops, and clean OS reinstallations.</div>
                </div>
              </div>

              <a
                href="#manual-restore-section"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-tally-cardHover hover:bg-tally-border text-white font-bold text-xs rounded-xl border border-tally-border transition-all"
              >
                <span>Upload &amp; Restore Custom File Below</span>
              </a>
            </div>
          </div>
        </div>

        {/* ── AUTOMATION & SCHEDULE CONFIGURATION ─────────────────────────── */}
        <div className="glass-card rounded-2xl p-6 border border-tally-border">
          <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-500/15 text-brand-400 rounded-xl">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Auto-Backup & Sync Schedule Settings</h3>
                <p className="text-xs text-tally-textMuted">
                  Customize backup timing, local storage directory, and cloud sync parameters.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                  className="rounded border-tally-border bg-tally-bg text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Auto-Backup Engine Active</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Schedule Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-tally-textMuted">
                Backup Schedule Interval
              </label>
              <select
                value={schedule}
                onChange={(e: any) => setSchedule(e.target.value)}
                className="w-full p-3 rounded-xl bg-tally-bg border border-tally-border text-white text-xs font-semibold focus:border-brand-500 outline-none"
              >
                <option value="15m">Every 15 Minutes</option>
                <option value="30m">Every 30 Minutes (Recommended)</option>
                <option value="1h">Every 1 Hour</option>
                <option value="daily">Daily at Fixed Time</option>
                <option value="realtime">Real-Time (On Every Bill Save)</option>
              </select>
              <p className="text-[11px] text-tally-textMuted">
                {schedule === '30m' && 'Updates the single master container every 30 minutes seamlessly.'}
                {schedule === '15m' && 'High-frequency protection for busy retail stores.'}
                {schedule === '1h' && 'Ideal for general offices with steady transactions.'}
                {schedule === 'daily' && 'Takes a single comprehensive backup at end of day.'}
                {schedule === 'realtime' && 'Updates master file immediately whenever an invoice or voucher is saved.'}
              </p>
            </div>

            {/* Daily Time Picker (if daily is chosen) */}
            {schedule === 'daily' && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-tally-textMuted">
                  Daily Execution Time (24h)
                </label>
                <input
                  type="time"
                  value={dailyTime}
                  onChange={(e) => setDailyTime(e.target.value)}
                  className="w-full p-3 rounded-xl bg-tally-bg border border-tally-border text-white text-xs font-semibold focus:border-brand-500 outline-none"
                />
                <p className="text-[11px] text-tally-textMuted">
                  Recommended: At shop/office closing time (e.g. 20:00).
                </p>
              </div>
            )}

            {/* Local Storage Path */}
            <div className={`space-y-2 ${schedule !== 'daily' ? 'md:col-span-2' : ''}`}>
              <label className="block text-xs font-semibold text-tally-textMuted">
                Local Master Backup Directory
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localBackupDir}
                  onChange={(e) => setLocalBackupDir(e.target.value)}
                  placeholder="e.g. D:\TallyBackup or C:\MyBackups"
                  className="flex-1 p-3 rounded-xl bg-tally-bg border border-tally-border text-white text-xs font-mono focus:border-brand-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleBrowseFolder}
                  className="px-3.5 py-3 rounded-xl bg-tally-cardHover hover:bg-tally-border border border-tally-border text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 text-brand-400" />
                  <span>Browse</span>
                </button>
              </div>
              <p className="text-[11px] text-tally-textMuted">
                Keep on a separate partition (e.g. D: drive) or external SSD so data survives OS formats.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end border-t border-tally-border pt-4">
            <button
              onClick={handleSaveSettings}
              disabled={savingConfig}
              className="py-2.5 px-6 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingConfig ? 'Saving Settings...' : 'Save Backup Settings'}
            </button>
          </div>
        </div>



        {/* ── MANUAL EXPORT / IMPORT SECTION (PRESERVED) ──────────────────── */}
        <div className="glass-card rounded-2xl p-6 border border-tally-border">
          <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-6">
            <div className="flex items-center gap-3">
              <FileJson className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="font-bold text-base text-white">Manual File Backup & Restore (USB / External File)</h3>
                <p className="text-xs text-tally-textMuted">
                  Manually download or upload raw JSON snapshot files for offline migration.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Manual Export */}
            <div className="p-5 rounded-xl border border-tally-border bg-tally-bg/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 font-bold text-white text-sm mb-2">
                  <Download className="w-4 h-4 text-brand-400" />
                  <span>Download Portable Backup (.JSON)</span>
                </div>
                <p className="text-xs text-tally-textMuted mb-4">
                  Generates an immediate standalone JSON file with all database records that you can save to a pen drive.
                </p>
              </div>
              <button
                onClick={handleExportBackup}
                disabled={exporting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 font-bold text-xs rounded-xl border border-brand-500/40 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{exporting ? 'Generating...' : 'Download JSON Snapshot'}</span>
              </button>
            </div>

            {/* Manual Import */}
            <div className="p-5 rounded-xl border border-tally-border bg-tally-bg/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 font-bold text-white text-sm mb-2">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Upload & Restore from File</span>
                </div>
                <div className="mb-3">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="block w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-tally-border file:text-white hover:file:bg-tally-cardHover cursor-pointer"
                  />
                </div>
                {parsedBackup && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-[11px] font-mono text-gray-300 mb-3">
                    Valid Backup v{parsedBackup.version}: {parsedBackup.summary?.totalRecords || 'N/A'} total records
                  </div>
                )}
              </div>
              <button
                onClick={handleExecuteRestore}
                disabled={!parsedBackup || importing}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-tally-bg font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-40"
              >
                <Upload className="w-4 h-4 fill-tally-bg" />
                <span>{importing ? 'Importing...' : 'Restore Selected File'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── MODULE SPECIFIC CSV EXPORTERS ───────────────────────────────── */}
        <div className="glass-card rounded-2xl p-6 border border-tally-border">
          <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-5">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="font-bold text-base text-white">Module-Specific CSV & Excel Quick Exporters</h3>
                <p className="text-xs text-tally-textMuted">Download individual spreadsheet reports for audit or external accounting</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <button
              onClick={handleExportVendorsCSV}
              className="p-4 rounded-xl bg-tally-bg/70 hover:bg-tally-cardHover border border-tally-border flex items-center justify-between group transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-brand-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <div className="font-semibold text-white">Vendors CSV</div>
                  <div className="text-[10px] text-tally-textMuted">Contacts & Balances</div>
                </div>
              </div>
              <Download className="w-4 h-4 text-gray-400 group-hover:text-white" />
            </button>

            <button
              onClick={handleExportItemsCSV}
              className="p-4 rounded-xl bg-tally-bg/70 hover:bg-tally-cardHover border border-tally-border flex items-center justify-between group transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Boxes className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <div className="font-semibold text-white">Inventory CSV</div>
                  <div className="text-[10px] text-tally-textMuted">SKUs, Tax & Prices</div>
                </div>
              </div>
              <Download className="w-4 h-4 text-gray-400 group-hover:text-white" />
            </button>

            <button
              onClick={handleExportInvoicesCSV}
              className="p-4 rounded-xl bg-tally-bg/70 hover:bg-tally-cardHover border border-tally-border flex items-center justify-between group transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <div className="font-semibold text-white">Invoices CSV</div>
                  <div className="text-[10px] text-tally-textMuted">Billing & Sales Log</div>
                </div>
              </div>
              <Download className="w-4 h-4 text-gray-400 group-hover:text-white" />
            </button>

            <button
              onClick={handleExportBankingCSV}
              className="p-4 rounded-xl bg-tally-bg/70 hover:bg-tally-cardHover border border-tally-border flex items-center justify-between group transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Landmark className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <div className="font-semibold text-white">Banking CSV</div>
                  <div className="text-[10px] text-tally-textMuted">Accounts & Cash Books</div>
                </div>
              </div>
              <Download className="w-4 h-4 text-gray-400 group-hover:text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
