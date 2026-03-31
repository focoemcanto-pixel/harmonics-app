'use client';

import React, { forwardRef } from 'react';

const Input = forwardRef(function Input(
  {
    label,
    value,
    onChange,
    placeholder = '',
    type = 'text',
    className = '',
    min,
    max,
    inputMode,
    autoComplete,
    disabled = false,
  },
  ref
) {
  return (
    <label className={`block ${className}`}>
      {label ? (
        <span className="mb-2 block text-sm font-medium text-slate-600">
          {label}
        </span>
      ) : null}

      <input
        ref={ref}
        type={type}
        value={value}
        min={min}
        max={max}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        disabled={disabled}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      />
    </label>
  );
});

export default Input;
