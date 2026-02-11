import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  delayDuration = 300,
}) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration}>
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="px-2 py-1 text-xs rounded max-w-[240px] z-50"
          style={{
            background: 'var(--vscode-toolbar-hoverBackground)',
            color: 'var(--vscode-foreground)',
            border: '1px solid var(--vscode-panel-border)',
          }}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>
);
