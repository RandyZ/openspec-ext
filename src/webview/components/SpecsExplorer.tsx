import React from 'react';
import { t } from '../../i18n';
import { useVscode } from '../hooks/useVscode';
import { sendMessage, type ProjectSpecsExplorerData, type SpecInfo } from '../types/messages';
import { SpecsSection } from './SpecsSection';

export interface SpecsExplorerProps {
  data: ProjectSpecsExplorerData;
}

export const SpecsExplorer: React.FC<SpecsExplorerProps> = ({ data }) => {
  const { postMessage } = useVscode();

  const openSpec = (spec: SpecInfo, binding: ProjectSpecsExplorerData['binding']) => {
    postMessage(sendMessage.openSpecInEditor(
      spec.id,
      undefined,
      undefined,
      data.project,
      binding,
    ));
  };

  return (
    <main
      data-testid="specs-explorer"
      data-project-id={data.project.id}
      data-root-path={data.binding.rootPath}
      className="p-4"
    >
      <header className="mb-4">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--vscode-foreground)' }}>
          {t('projectSidebar.specs')}
        </h1>
        <div className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {data.project.label} · {data.binding.rootPath}
        </div>
      </header>

      <SpecsSection
        specs={data.projectSpecs}
        heading="Project Specs"
        emptyMessage="No project specs"
        sourceLabel={data.project.label}
        readOnly
        onOpenSpec={(spec) => openSpec(spec, data.binding)}
      />

      {data.referencedStoreSpecs.map((group) => (
        <SpecsSection
          key={group.storeId}
          specs={group.specs}
          heading={`Referenced Store Specs: ${group.storeId}`}
          emptyMessage={`No specs in referenced Store ${group.storeId}`}
          loadError={group.error}
          sourceLabel={group.storeId}
          readOnly
          onOpenSpec={group.binding ? (spec) => openSpec(spec, group.binding!) : undefined}
        />
      ))}
    </main>
  );
};
