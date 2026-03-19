import React from 'react';
import { useApp } from '@/context/AppContext';
import type { LotVersion } from '@/types';

interface Props {
  versions: LotVersion[];
  lotNo: string;
  masterItems: { id: string; name: string }[];
}

const ComparisonTable: React.FC<Props> = ({ versions, lotNo, masterItems }) => {
  const { getDyesForVersion } = useApp();

  // Collect all unique dye IDs across all versions
  const allDyeIds = new Set<string>();
  const versionDyes = versions.map(v => {
    const dyes = getDyesForVersion(v.id);
    dyes.forEach(d => allDyeIds.add(d.dye_id));
    return { version: v, dyes };
  });

  const dyeIds = Array.from(allDyeIds);
  if (dyeIds.length === 0) return <p className="text-sm text-muted-foreground py-4">No dye data to compare.</p>;

  const getDyeName = (id: string) => masterItems.find(m => m.id === id)?.name || id;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary/50">
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Dye</th>
            {versions.map(v => (
              <th key={v.id} className="text-right px-4 py-2 font-medium text-muted-foreground">
                Version {v.version_code} (%)
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dyeIds.map(dyeId => {
            const values = versionDyes.map(vd => {
              const found = vd.dyes.find(d => d.dye_id === dyeId);
              return found?.percentage ?? null;
            });
            return (
              <tr key={dyeId} className="row-separator">
                <td className="px-4 py-2 font-medium">{getDyeName(dyeId)}</td>
                {values.map((val, i) => {
                  const changed = i > 0 && val !== values[i - 1];
                  return (
                    <td
                      key={i}
                      className={`px-4 py-2 text-right font-data ${changed ? 'bg-correction/10' : ''}`}
                    >
                      {val !== null ? val : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonTable;
