import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: { value: string; label: string }[];
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  value,
  onValueChange,
  items,
  children,
  className = '',
}) => (
  <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={className}>
    <TabsPrimitive.List
      className="flex border-b gap-1"
      style={{ borderColor: 'var(--vscode-panel-border)' }}
    >
      {items.map((item) => (
        <TabsPrimitive.Trigger
          key={item.value}
          value={item.value}
          className="px-3 py-2 text-xs font-medium cursor-pointer border-b-2 -mb-px transition-colors"
          style={{
            borderColor: value === item.value ? 'var(--vscode-focusBorder)' : 'transparent',
            color: value === item.value ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
          }}
        >
          {item.label}
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>
    {children}
  </TabsPrimitive.Root>
);

export const TabsContent = TabsPrimitive.Content;
