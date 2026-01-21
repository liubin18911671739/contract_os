import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTask, getTaskEvents } from '../api/tasks';
import { Button } from '../components/ui/Button';
import { Stepper } from '../components/ui/Stepper';
import { Timeline } from '../components/ui/Timeline';
import { ProgressBar } from '../components/ui/Progress';

const STAGES = ['QUEUED', 'PARSING', 'STRUCTURING', 'RULE_SCORING', 'KB_RETRIEVAL', 'LLM_RISK', 'EVIDENCING', 'QCING', 'DONE'];

export default function Processing() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!taskId) return;

    const load = async () => {
      try {
        const [taskData, eventsData] = await Promise.all([getTask(taskId), getTaskEvents(taskId)]);
        setTask(taskData);
        setEvents(eventsData);

        if (taskData.status === 'DONE' || taskData.status === 'FAILED' || taskData.status === 'CANCELLED') {
          setPolling(false);
          if (taskData.status === 'DONE') {
            setTimeout(() => navigate(`/results/${taskId}`), 1000);
          }
        }
      } catch (error) {
        console.error('Failed to load task:', error);
      }
    };

    load();
    const interval = polling ? setInterval(load, 2000) : undefined;
    return () => clearInterval(interval);
  }, [taskId, polling, navigate]);

  if (!task) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const steps = STAGES.map((stage) => {
    const currentIndex = STAGES.indexOf(task.current_stage);
    const stepIndex = STAGES.indexOf(stage);
    let status: 'pending' | 'active' | 'completed' | 'error' = 'pending';

    if (stepIndex < currentIndex || task.status === 'DONE') status = 'completed';
    else if (stage === task.current_stage) status = 'active';
    if (task.status === 'FAILED' && stage === task.current_stage) status = 'error';

    return { label: stage, status };
  });

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Processing Task</h2>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Back to Dashboard
        </Button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-500">{task.progress}%</span>
          </div>
          <ProgressBar progress={task.progress} />
        </div>

        <Stepper steps={steps} />
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Activity Log</h3>
        <Timeline events={events} />
      </div>

      {task.error_message && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <strong>Error:</strong> {task.error_message}
        </div>
      )}
    </div>
  );
}
