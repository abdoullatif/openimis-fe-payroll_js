import React from 'react';
import { Alert } from '@material-ui/lab';
import { useModulesManager, useTranslations } from '@openimis/fe-core';
import { MODULE_NAME } from '../../constants';
import { getTruncatedListCustomMessage, isListTruncated } from '../../utils/taskBusinessDataUtils';

function TaskTruncatedListAlert({ incoming }) {
  const modulesManager = useModulesManager();
  const { formatMessage } = useTranslations(MODULE_NAME, modulesManager);

  if (!isListTruncated(incoming)) {
    return null;
  }

  const customMessage = getTruncatedListCustomMessage(incoming);
  const message = customMessage || formatMessage('tasks.truncatedListNotice');

  return (
    <Alert severity="info" style={{ marginBottom: 12, marginTop: 8 }}>
      {message}
    </Alert>
  );
}

export default TaskTruncatedListAlert;
