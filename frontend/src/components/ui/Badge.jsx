import React from 'react';

const Badge = ({
  children,
  status,
  variant,
  size = 'md',
  dot = false,
  className = '',
}) => {
  const badgeType = status || variant || 'default';

  const styles = {
    default: 'bg-gray-100 text-gray-700 border-gray-200/80',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200/80',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
    info: 'bg-blue-50 text-blue-700 border-blue-200/80',
    purple: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
  };

  const dotColors = {
    default: 'bg-gray-400',
    neutral: 'bg-slate-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-blue-500',
    purple: 'bg-indigo-500',
    cyan: 'bg-cyan-500',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-0.5 text-xs',
  };

  const resolvedStyle = styles[badgeType] || styles.default;
  const resolvedDot = dotColors[badgeType] || dotColors.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${resolvedStyle} ${sizes[size] || sizes.md} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${resolvedDot}`} />}
      <span>{children}</span>
    </span>
  );
};

export default Badge;
