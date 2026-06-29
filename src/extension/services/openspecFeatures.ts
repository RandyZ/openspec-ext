/**
 * OpenSpec feature detection — probes the resolved CLI for store/context/doctor/workset support.
 * Probe failure MUST NOT break the base dashboard; it produces diagnostics instead.
 */

export interface OpenSpecCapabilities {
  stores: boolean;
  context: boolean;
  doctor: boolean;
  worksets: boolean;
  diagnostics: {
    code: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }[];
}

export async function detectOpenSpecFeatures(
  cli: { runJson: (args: string[]) => Promise<unknown> },
): Promise<OpenSpecCapabilities> {
  const diagnostics: OpenSpecCapabilities['diagnostics'] = [];

  const probe = async (args: string[], code: string): Promise<boolean> => {
    try {
      await cli.runJson(args);
      return true;
    } catch (error) {
      diagnostics.push({
        code,
        severity: 'warning',
        message: (error as Error).message,
      });
      return false;
    }
  };

  const [stores, context, doctor, worksets] = await Promise.all([
    probe(['store', 'list', '--json'], 'store_features_unavailable'),
    probe(['context', '--json'], 'context_feature_unavailable'),
    probe(['doctor', '--json'], 'doctor_feature_unavailable'),
    probe(['workset', 'list', '--json'], 'workset_feature_unavailable'),
  ]);

  return {
    stores,
    context,
    doctor,
    worksets,
    diagnostics,
  };
}
