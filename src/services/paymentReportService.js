import { baseApiUrl } from '@openimis/fe-core';

/**
 * Service for managing payment reports (PDF)
 */

/**
 * List all payment reports for a payroll
 * @param {string} payrollId - The payroll ID
 * @returns {Promise<Array>} List of payment reports with file_name, date_created, uploaded_by
 */
export function listPaymentReports(payrollId) {
  const url = new URL(
    `${window.location.origin}${baseApiUrl}/payroll/payment_reports/`,
  );
  url.searchParams.append('payroll_id', payrollId);

  return fetch(url, { method: 'GET' })
    .then((response) => {
      if (!response.ok) {
        return response
          .json()
          .catch(() => response.text().then((t) => ({ error: t })))
          .then((err) => {
            const message = err?.error || err?.detail || `Failed to list payment reports: ${response.statusText}`;
            throw new Error(message);
          });
      }
      return response.json();
    })
    .then((data) => data || [])
    .catch((error) => {
      console.error('Error listing payment reports:', error);
      throw error;
    });
}

/**
 * Download a payment report PDF
 * @param {string} payrollId - The payroll ID
 * @param {string} fileName - The file name to download
 * @returns {Promise<void>}
 */
export function downloadPaymentReport(payrollId, fileName) {
  const url = new URL(
    `${window.location.origin}${baseApiUrl}/payroll/payment_reports/`,
  );
  url.searchParams.append('payroll_id', payrollId);
  // Ensure proper encoding (spaces, special chars)
  url.searchParams.append('file_name', fileName);

  return fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/pdf,*/*',
    },
  })
    .then((response) => {
      if (!response.ok) {
        return response
          .json()
          .catch(() => response.text().then((t) => ({ error: t })))
          .then((err) => {
            const message = err?.error || err?.detail || `Failed to download payment report: ${response.statusText}`;
            throw new Error(message);
          });
      }
      const disposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition');
      let suggestedName = fileName;
      if (disposition) {
        // content-disposition: attachment; filename="name.pdf"; filename*=UTF-8''name.pdf
        const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
        const extracted = decodeURIComponent(match?.[1] || match?.[2] || '');
        if (extracted) suggestedName = extracted;
      }
      return response.blob().then((blob) => ({ blob, suggestedName }));
    })
    .then(({ blob, suggestedName }) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = suggestedName || fileName || 'report.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      return { success: true };
    })
    .catch((error) => {
      console.error('Error downloading payment report:', error);
      throw error;
    });
}

/**
 * Upload a payment report PDF
 * @param {string} payrollId - The payroll ID
 * @param {File} file - The PDF file to upload
 * @returns {Promise<Object>} Upload result
 */
export function uploadPaymentReport(payrollId, file) {
  // Validate file extension
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return Promise.reject(new Error('Only PDF files are allowed'));
  }

  const formData = new FormData();
  formData.append('file', file);

  // Align with BE: POST /api/payroll/payment_reports/?payroll_id=<uuid>
  const url = new URL(
    `${window.location.origin}${baseApiUrl}/payroll/payment_reports/`,
  );
  url.searchParams.append('payroll_id', payrollId);

  return fetch(url, {
    method: 'POST',
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        // Try to parse JSON error; if not JSON, fallback to text
        return response
          .json()
          .catch(() => response.text().then((t) => ({ detail: t })))
          .then((errorData) => {
            const message = errorData?.error || errorData?.detail || `Failed to upload payment report: ${response.statusText}`;
            throw new Error(message);
          });
      }
      return response.json();
    })
    .catch((error) => {
      console.error('Error uploading payment report:', error);
      throw error;
    });
}

