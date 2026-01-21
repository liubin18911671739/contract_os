import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import {
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/Progress';

interface Task {
  id: string;
  status: string;
  progress: number;
  current_stage: string;
  created_at: string;
}

export default function Dashboard() {
  const [tasks] = useState<Task[]>([
    // Demo tasks - in production, fetch from API
    {
      id: 'demo1',
      status: 'DONE',
      progress: 100,
      current_stage: 'DONE',
      created_at: new Date().toISOString(),
    },
  ]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Tasks</h2>
        <Link to="/new-task">
          <Button>New Task</Button>
        </Link>
      </div>

      <Table>
        <TableHead>
          <TableHeader>Task ID</TableHeader>
          <TableHeader>Status</TableHeader>
          <TableHeader>Progress</TableHeader>
          <TableHeader>Stage</TableHeader>
          <TableHeader>Created</TableHeader>
          <TableHeader>Actions</TableHeader>
        </TableHead>
        <TableBody>
          {tasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-500">
                No tasks yet. Create your first task!
              </TableCell>
            </TableRow>
          ) : (
            tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-mono text-sm">{task.id.substring(0, 12)}...</TableCell>
                <TableCell>
                  <Badge color={task.status === 'DONE' ? 'emerald' : 'blue'}>{task.status}</Badge>
                </TableCell>
                <TableCell className="w-48">
                  <ProgressBar progress={task.progress} />
                </TableCell>
                <TableCell>{task.current_stage}</TableCell>
                <TableCell>{new Date(task.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  {task.status === 'DONE' ? (
                    <Link to={`/results/${task.id}`}>
                      <Button size="sm" variant="secondary">
                        View Results
                      </Button>
                    </Link>
                  ) : (
                    <Link to={`/processing/${task.id}`}>
                      <Button size="sm" variant="ghost">
                        View Progress
                      </Button>
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
