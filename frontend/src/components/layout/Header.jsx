import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';

const Header = () => {
  const { user, business, logout } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header className="bg-white border-b border-gray-200/90 shadow-2xs shrink-0 z-10">
      <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center h-16">
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
            <span>Workspace</span>
          </span>
          <span className="text-sm font-semibold text-gray-900 truncate max-w-xs sm:max-w-md">
            {business?.name || 'My Business'}
          </span>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
              {getInitials(user?.name)}
            </div>
            <div className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-xs font-semibold text-gray-900">{user?.name || 'Authorized User'}</span>
              <span className="text-[11px] text-gray-500 font-mono">{business?.gstin || user?.email || 'GST Portal'}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-gray-200 hidden sm:block" />

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-gray-500 hover:text-rose-600 hover:bg-rose-50"
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            }
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
