import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createContract, uploadContractVersion } from '../api/contracts';
import { createTask } from '../api/tasks';
import { getKBCollections } from '../api/kb';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Alert } from '../components/ui/Alert';

export default function NewTaskUpload() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    contract_name: '',
    counterparty: '',
    contract_type: 'SERVICE',
    kb_mode: 'STRICT',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || selectedCollections.length === 0) {
      setError('Please select a file and at least one KB collection');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create contract
      const contract = await createContract({
        contract_name: formData.contract_name,
        counterparty: formData.counterparty || undefined,
        contract_type: formData.contract_type,
      });

      // Upload file
      const version = await uploadContractVersion(contract.id, selectedFile);

      // Create task
      const task = await createTask({
        contract_version_id: version.id,
        kb_collection_ids: selectedCollections,
        kb_mode: formData.kb_mode as any,
      });

      navigate(`/processing/${task.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  }

  function toggleCollection(collectionId: string) {
    setSelectedCollections((prev) =>
      prev.includes(collectionId)
        ? prev.filter((id) => id !== collectionId)
        : [...prev, collectionId]
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">New Pre-check Task</h2>

      {error && (
        <Alert type="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contract Name</label>
          <Input
            value={formData.contract_name}
            onChange={(e) => setFormData({ ...formData, contract_name: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Counterparty</label>
          <Input
            value={formData.counterparty}
            onChange={(e) => setFormData({ ...formData, counterparty: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contract Type</label>
          <Select
            value={formData.contract_type}
            onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
          >
            <option value="SERVICE">Service Agreement</option>
            <option value="SALES">Sales Contract</option>
            <option value="NDA">NDA</option>
            <option value="EMPLOYMENT">Employment Agreement</option>
            <option value="OTHER">Other</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contract File</label>
          <input
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Supported: TXT (PoC), PDF, DOCX (stub)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            KB Collections (select at least one)
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
            {collections.map((collection) => (
              <label key={collection.id} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCollections.includes(collection.id)}
                  onChange={() => toggleCollection(collection.id)}
                  className="rounded"
                />
                <span>{collection.name}</span>
                <span className="text-xs text-gray-500">({collection.scope})</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">KB Mode</label>
          <Select
            value={formData.kb_mode}
            onChange={(e) => setFormData({ ...formData, kb_mode: e.target.value })}
          >
            <option value="STRICT">Strict (KB required)</option>
            <option value="RELAXED">Relaxed (KB optional)</option>
          </Select>
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/')}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </form>
    </div>
  );
}
