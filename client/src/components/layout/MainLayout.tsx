/**
 * MainLayout Component
 * Combines Sidebar and Header with main content area
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const [activeItem, setActiveItem] = useState('dashboard');

  // Update active item based on current path
  useEffect(() => {
    const pathToItem: Record<string, string> = {
      '/': 'dashboard',
      '/kb': 'kb',
      '/new-task': 'upload',
      '/processing': 'tasks',
      '/results': 'tasks',
      '/review': 'tasks',
      '/evaluation': 'evaluation',
      '/settings': 'settings',
    };
    setActiveItem(pathToItem[location.pathname] || 'dashboard');
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeItem={activeItem} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto bg-content p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
