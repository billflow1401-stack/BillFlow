import React from 'react';

export const Table = ({ children, className = '', containerClassName = '' }) => {
  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-gray-200/90 bg-white shadow-2xs ${containerClassName}`}>
      <table className={`min-w-full divide-y divide-gray-200/80 text-left text-sm ${className}`}>
        {children}
      </table>
    </div>
  );
};

export const Thead = ({ children, className = '' }) => (
  <thead className={`bg-gray-50/80 border-b border-gray-200/80 ${className}`}>{children}</thead>
);

export const Tbody = ({ children, className = '' }) => (
  <tbody className={`divide-y divide-gray-100 bg-white ${className}`}>{children}</tbody>
);

export const Tr = ({ children, className = '', hover = true }) => (
  <tr className={`${hover ? 'hover:bg-slate-50/70 transition-colors duration-100' : ''} ${className}`}>
    {children}
  </tr>
);

export const Th = ({ children, className = '', align = 'left' }) => {
  const aligns = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <th
      scope="col"
      className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 select-none ${aligns[align] || aligns.left} ${className}`}
    >
      {children}
    </th>
  );
};

export const Td = ({ children, className = '', align = 'left' }) => {
  const aligns = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <td className={`px-4 py-3.5 text-sm text-gray-700 align-middle ${aligns[align] || aligns.left} ${className}`}>
      {children}
    </td>
  );
};

export const TableEmpty = ({ colSpan, message = 'No records found.', action = null, icon = null }) => (
  <Tr hover={false}>
    <Td colSpan={colSpan} className="text-center py-12">
      <div className="flex flex-col items-center justify-center gap-2">
        {icon ? (
          <div className="text-gray-300 mb-1">{icon}</div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
        )}
        <p className="text-sm font-medium text-gray-500">{message}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </Td>
  </Tr>
);
