import React from 'react';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  leftIcon = null,
  rightIcon = null,
  type = 'button',
  ...props
}) => {
  const baseStyle =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary:
      'bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800 focus-visible:ring-indigo-500 border border-transparent',
    secondary:
      'bg-white text-gray-700 border border-gray-200 shadow-2xs hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 focus-visible:ring-indigo-500',
    danger:
      'bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:bg-rose-800 focus-visible:ring-rose-500 border border-transparent',
    success:
      'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-500 border border-transparent',
    outline:
      'bg-transparent text-indigo-600 border border-indigo-300 hover:bg-indigo-50/70 hover:border-indigo-400 focus-visible:ring-indigo-500',
    ghost:
      'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 active:bg-gray-200/60 focus-visible:ring-indigo-500 border border-transparent',
  };

  const sizes = {
    xs: 'px-2.5 py-1 text-xs gap-1.5',
    sm: 'px-3 py-1.5 text-xs font-medium gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  return (
    <button
      type={type}
      className={`${baseStyle} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin -ml-0.5 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!loading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};

export default Button;
