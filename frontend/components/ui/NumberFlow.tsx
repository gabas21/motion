'use client';

import React, { useEffect, useState } from 'react';
import NumberFlowReact from '@number-flow/react';

interface NumberFlowProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  format?: React.ComponentProps<typeof NumberFlowReact>['format'];
}

export default function NumberFlow({ value, className, prefix, suffix, format }: NumberFlowProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <span className={className}>
        {prefix}{value.toLocaleString()}{suffix}
      </span>
    );
  }

  return (
    <NumberFlowReact
      value={value}
      className={className}
      prefix={prefix}
      suffix={suffix}
      format={format}
    />
  );
}
