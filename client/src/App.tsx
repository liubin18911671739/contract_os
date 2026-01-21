import { Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import KBAdmin from './pages/KBAdmin';
import NewTaskUpload from './pages/NewTaskUpload';
import Processing from './pages/Processing';
import Results from './pages/Results';
import Review from './pages/Review';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-gray-900">Contract Pre-check</h1>
              <div className="flex space-x-4">
                <Link to="/" className="text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                  Dashboard
                </Link>
                <Link to="/kb" className="text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                  Knowledge Base
                </Link>
                <Link to="/new-task" className="text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                  New Task
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kb" element={<KBAdmin />} />
          <Route path="/new-task" element={<NewTaskUpload />} />
          <Route path="/processing/:taskId" element={<Processing />} />
          <Route path="/results/:taskId" element={<Results />} />
          <Route path="/review/:taskId" element={<Review />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
