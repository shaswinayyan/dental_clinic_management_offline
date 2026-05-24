import { useEffect, useState } from 'react'
import { Card, Button, Input, message, Alert, Divider, Typography, Descriptions, Modal, Spin } from 'antd'
import { DatabaseOutlined, FolderOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons'
import type { AppSettings, IpcResult } from '../../../../shared/types'
import type { Route } from '../../components/Layout/MainLayout'

interface Props { navigate: (r: Route) => void }

export default function BackupRestore({ navigate }: Props) {
  const [dbPath, setDbPath] = useState('')
  const [backupPath, setBackupPath] = useState('')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [backing, setBacking] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [lastBackupFile, setLastBackupFile] = useState('')
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [selectedRestoreFile, setSelectedRestoreFile] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [dbRes, settRes] = await Promise.all([
        window.api.settings.getDbPath() as Promise<IpcResult<string>>,
        window.api.settings.get() as Promise<IpcResult<AppSettings>>
      ])
      if (dbRes.success && dbRes.data) setDbPath(dbRes.data)
      if (settRes.success && settRes.data) { setSettings(settRes.data); setBackupPath(settRes.data.backup_path) }
      setLoading(false)
    }
    load()
  }, [])

  async function selectBackupFolder() {
    const r = await window.api.settings.selectBackupFolder() as IpcResult<string>
    if (r.success && r.data) {
      setBackupPath(r.data)
      await window.api.settings.update({ backup_path: r.data })
      message.success('Backup folder saved')
    }
  }

  async function handleBackup() {
    setBacking(true)
    try {
      const r = await window.api.settings.backup(backupPath || undefined) as IpcResult<string>
      if (r.success && r.data) {
        setLastBackupFile(r.data)
        message.success(`Backup created: ${r.data}`)
      } else {
        message.error(r.error || 'Backup failed')
      }
    } finally { setBacking(false) }
  }

  async function selectAndRestore() {
    const r = await window.api.settings.selectBackupFile() as IpcResult<string>
    if (r.success && r.data) { setSelectedRestoreFile(r.data); setConfirmRestore(true) }
  }

  async function handleRestore() {
    setRestoring(true)
    try {
      const r = await window.api.settings.restore(selectedRestoreFile) as IpcResult
      if (r.success) {
        message.success('Data restored successfully. Please restart the application.')
        setConfirmRestore(false)
      } else {
        message.error(r.error || 'Restore failed')
      }
    } finally { setRestoring(false) }
  }

  if (loading) return <Spin />

  return (
    <div style={{ maxWidth: 700 }}>
      <Card title={<span><DatabaseOutlined /> Database Information</span>} style={{ marginBottom: 16 }}>
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="Database Location">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>{dbPath}</code>
              <Button size="small" onClick={() => window.api.settings.openDbFolder()}>Open Folder</Button>
            </div>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={<span><SaveOutlined /> Backup</span>} style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>Backup Destination Folder</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input value={backupPath} readOnly placeholder="No folder selected" style={{ flex: 1 }} />
            <Button icon={<FolderOutlined />} onClick={selectBackupFolder}>Browse</Button>
          </div>
        </div>
        {lastBackupFile && (
          <Alert type="success" message={`Last backup: ${lastBackupFile}`} style={{ marginBottom: 12 }} />
        )}
        <Alert type="info" style={{ marginBottom: 12 }}
          message="Backup includes the full database and all patient images. The backup file is a compressed archive."
          showIcon />
        <Button type="primary" icon={<SaveOutlined />} loading={backing} onClick={handleBackup} disabled={!backupPath}>
          Backup Now
        </Button>
      </Card>

      <Card title={<span><UploadOutlined /> Restore from Backup</span>}>
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          message="Restoring will overwrite all current data. A pre-restore backup will be created automatically before restoring." />
        <Button danger icon={<UploadOutlined />} onClick={selectAndRestore}>
          Select Backup File & Restore
        </Button>
      </Card>

      <Modal
        open={confirmRestore}
        title="Confirm Restore"
        onCancel={() => setConfirmRestore(false)}
        footer={[
          <Button key="cancel" onClick={() => setConfirmRestore(false)}>Cancel</Button>,
          <Button key="restore" type="primary" danger loading={restoring} onClick={handleRestore}>Restore Data</Button>
        ]}
      >
        <Alert type="warning" showIcon
          message="This will overwrite ALL current data with the backup. This action cannot be undone."
          description={<div><strong>File:</strong> {selectedRestoreFile}</div>}
          style={{ marginBottom: 12 }}
        />
        <p>A backup of the current data will be created automatically before proceeding.</p>
      </Modal>
    </div>
  )
}
