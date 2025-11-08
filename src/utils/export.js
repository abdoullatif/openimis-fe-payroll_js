import { baseApiUrl } from '@openimis/fe-core';

export default async function downloadPayroll(payrollId, payrollFileName, blank = true) {
  const url = new URL(`${window.location.origin}${baseApiUrl}/payroll/csv_reconciliation/`);
  url.searchParams.append('payroll_id', payrollId);
  url.searchParams.append('blank', String(blank));
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const err = await response
        .json()
        .catch(() => response.text().then((t) => ({ error: t })));
      throw new Error(err?.error || err?.detail || `${response.status} ${response.statusText}`);
    }
    const disposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition');
    let headerFileName = null;
    if (disposition) {
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
      headerFileName = decodeURIComponent(match?.[1] || match?.[2] || '');
    }
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fallback = blank ? `reconciliation_${payrollFileName}.csv` : `${payrollFileName}.csv`;
    link.download = headerFileName || fallback;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    return { success: true };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Export failed, reason: ', e);
    throw e || new Error('Export failed');
  }
}
