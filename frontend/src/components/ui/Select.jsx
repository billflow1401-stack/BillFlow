import React from 'react';

const Select = React.forwardRef(({
  label,
  id,
  error,
  helperText,
  children,
  className = '',
  selectClassName = '',
  ...props
}, ref) => {
  const selectId = id || props.name;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <div className="relative rounded-lg shadow-2xs">
        <select
          ref={ref}
          id={selectId}
          className={`block w-full h-10 pl-3.5 pr-10 py-2 text-sm text-gray-900 bg-white border rounded-lg transition-colors duration-150 appearance-none focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-300 bg-rose-50/20 text-rose-900 focus:ring-rose-500/20 focus:border-rose-500'
              : 'border-gray-200 hover:border-gray-300 focus:ring-indigo-500/20 focus:border-indigo-500'
          } disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${selectClassName}`}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p className="mt-1 text-xs text-rose-600 font-medium" id={`${selectId}-error`}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-xs text-gray-500">
          {helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
