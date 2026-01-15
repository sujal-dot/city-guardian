import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileWarning,
  Brain,
  Shield,
  Map,
  Route,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: FileWarning, label: 'Incidents', path: '/incidents' },
  { icon: Brain, label: 'Crime Prediction', path: '/prediction' },
  { icon: Shield, label: 'Risk Scoring', path: '/risk-scoring' },
  { icon: Map, label: 'Safety Heatmap', path: '/heatmap' },
  { icon: Route, label: 'AI Patrol', path: '/patrol' },
  { icon: Settings, label: 'Admin', path: '/admin' },
  { icon: Users, label: 'Citizen Portal', path: '/citizen' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo Section */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center w-full')}>
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-risk-safe animate-pulse" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-lg font-bold text-foreground">LokRakshak</h1>
              <p className="text-xs text-muted-foreground">Crime Intelligence</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3 mt-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'nav-item',
                isActive && 'active',
                collapsed && 'justify-center px-3'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Live Status */}
      {!collapsed && (
        <div className="absolute bottom-20 left-3 right-3">
          <div className="card-stat p-4">
            <div className="flex items-center gap-2 mb-2">
              <Radio className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-xs font-medium text-foreground">Live Status</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">System Status</span>
              <span className="flex items-center gap-1">
                <span className="status-dot status-online" />
                <span className="text-risk-safe">Online</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-muted-foreground">Alert Level</span>
              <span className="text-risk-high font-medium">Elevated</span>
            </div>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
