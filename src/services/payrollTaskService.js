import {
  graphql,
  formatPageQueryWithCount,
  parseData,
  decodeId,
} from '@openimis/fe-core';

const TASK_PROJECTION = () => [
  'id',
  'status',
  'businessEvent',
  'source',
  'entityId',
];

/**
 * Loads payroll_reconciliation tasks for a payroll (used for reconciliationLocked).
 * Returns [] if the tasks query is unavailable.
 */
export function fetchPayrollReconciliationTasksThunk(payrollId) {
  const params = [
    `entityId: "${payrollId}"`,
    'source: "payroll_reconciliation"',
  ];
  const payload = formatPageQueryWithCount('task', params, TASK_PROJECTION());
  return (dispatch) => graphql(payload, 'PAYROLL_RECONCILIATION_TASKS_FETCH')(
    dispatch,
  ).then(
    (action) => {
      if (action?.error || action?.payload?.errors) {
        return [];
      }
      const tasks = parseData(action?.payload?.data?.task) ?? [];
      return tasks.map((task) => ({
        ...task,
        id: task.id ? decodeId(task.id) : task.id,
        entityId: task.entityId ? decodeId(task.entityId) : task.entityId,
      }));
    },
    () => [],
  );
}
