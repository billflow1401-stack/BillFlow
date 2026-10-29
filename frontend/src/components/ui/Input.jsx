import React from 'react';

const Input = React.forwardRef(({
  label,
  id,
  error,
  helperText,
  prefix,
  suffix,
  className = '',
  inputClassName = '',
  ...props
}, ref) => {
  const inputId = id || props.name;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <div className="relative rounded-lg shadow-2xs">
        {prefix && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-sm">
            {prefix}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`block w-full h-10 ${prefix ? 'pl-8' : 'px-3.5'} ${suffix ? 'pr-8' : 'px-3.5'} py-2 text-sm text-gray-900 bg-white border rounded-lg transition-colors duration-150 placeholder:text-gray-400 focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-300 bg-rose-50/20 text-rose-900 focus:ring-rose-500/20 focus:border-rose-500'
              : 'border-gray-200 hover:border-gray-300 focus:ring-indigo-500/20 focus:border-indigo-500'
          } disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${inputClassName}`}
          {...props}
        />
        {suffix && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400 text-sm">
            {suffix}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-rose-600 font-medium" id={`${inputId}-error`}>
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

Input.displayName = 'Input';

export default Input;
