import { useState, useEffect } from 'react';
import { createKBCollection, getKBCollections, uploadKBDocument } from '../api/kb';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from '../components/ui/Table';

export default function KBAdmin() {
  const [collections, setCollections] = useState<any[]>([]);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({ name: '', scope: 'GLOBAL' });

  useEffect(() => {
    loadCollections();
  }, []);

  async function loadCollections() {
    try {
      const data = await getKBCollections();
      setCollections(data);
    } catch (error) {
      console.error('Failed to load collections:', error);
    }
  }

  async function handleCreateCollection(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createKBCollection({ name: formData.name, scope: formData.scope as any });
      setShowNewCollection(false);
      setFormData({ name: '', scope: 'GLOBAL' });
      loadCollections();
    } catch (error) {
      console.error('Failed to create collection:', error);
    }
  }

  async function handleUploadDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !formData.name) return;

    try {
      await uploadKBDocument(formData.name, selectedFile, selectedFile.name);
      setShowUploadDoc(false);
      setSelectedFile(null);
      loadCollections();
    } catch (error) {
      console.error('Failed to upload document:', error);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Knowledge Base</h2>
        <div className="space-x-2">
          <Button variant="secondary" onClick={() => setShowNewCollection(true)}>
            New Collection
          </Button>
          <Button onClick={() => setShowUploadDoc(true)}>Upload Document</Button>
        </div>
      </div>

      <Table>
        <TableHead>
          <TableHeader>Name</TableHeader>
          <TableHeader>Scope</TableHeader>
          <TableHeader>Version</TableHeader>
          <TableHeader>Created</TableHeader>
        </TableHead>
        <TableBody>
          {collections.map((collection) => (
            <TableRow key={collection.id}>
              <TableCell>{collection.name}</TableCell>
              <TableCell>{collection.scope}</TableCell>
              <TableCell>{collection.version}</TableCell>
              <TableCell>{new Date(collection.created_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal isOpen={showNewCollection} onClose={() => setShowNewCollection(false)} title="Create Collection">
        <form onSubmit={handleCreateCollection} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <Select
              value={formData.scope}
              onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
            >
              <option value="GLOBAL">Global</option>
              <option value="TENANT">Tenant</option>
              <option value="PROJECT">Project</option>
              <option value="DEPT">Department</option>
            </Select>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={() => setShowNewCollection(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showUploadDoc} onClose={() => setShowUploadDoc(false)} title="Upload Document">
        <form onSubmit={handleUploadDocument} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
            <Select
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            >
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={() => setShowUploadDoc(false)}>
              Cancel
            </Button>
            <Button type="submit">Upload</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
