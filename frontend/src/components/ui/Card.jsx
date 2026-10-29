import React from 'react';

export const Card = ({
  children,
  title,
  subtitle,
  action,
  headerClassName = '',
  className = '',
  padding = 'default',
  ...props
}) => {
  const paddings = {
    none: '',
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8',
  };

  const hasHeader = Boolean(title || subtitle || action);

  return (
    <div
      className={`bg-white rounded-xl shadow-xs border border-gray-200/90 transition-shadow ${className}`}
      {...props}
    >
      {hasHeader && (
        <div className={`px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4 ${headerClassName}`}>
          <div>
            {title && <h3 className="text-base font-semibold text-gray-900 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={padding !== 'none' ? paddings[padding] || paddings.default : ''}>
        {children}
      </div>
    </div>
  );
};

export default Card;
