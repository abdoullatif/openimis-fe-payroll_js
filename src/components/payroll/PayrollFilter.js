import React from 'react';

import { FormControlLabel, Grid, Checkbox } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';

import {
  ControlledField,
  useModulesManager,
  useTranslations,
  PublishedComponent,
  decodeId,
} from '@openimis/fe-core';
import PayrollNameFilterSuggestionField from './PayrollNameFilterSuggestionField';
import {
  CONTAINS_LOOKUP,
  EMPTY_STRING,
  MODULE_NAME,
} from '../../constants';
import PayrollStatusPicker from './PayrollStatusPicker';
import PaymentMethodPicker from '../../pickers/PaymentMethodPicker';

const useStyles = makeStyles((theme) => ({
  form: {
    padding: '0 0 10px 0',
    width: '100%',
  },
  item: {
    padding: theme.spacing(1),
  },
}));

function PayrollFilter({
  filters, onChangeFilters, statusReadOnly = false,
}) {
  const classes = useStyles();
  const modulesManager = useModulesManager();
  const { formatMessage } = useTranslations(MODULE_NAME, modulesManager);

  const filterTextFieldValue = (filterName) => filters?.[filterName]?.value ?? EMPTY_STRING;

  const filterValue = (filterName) => filters?.[filterName]?.value ?? null;

  const onChangeStringFilter = (filterName, value, lookup = null) => {
    if (lookup) {
      onChangeFilters([
        {
          id: filterName,
          value,
          filter: `${filterName}_${lookup}: "${value}"`,
        },
      ]);
    } else {
      onChangeFilters([
        {
          id: filterName,
          value,
          filter: `${filterName}: "${value}"`,
        },
      ]);
    }
  };

  return (
    <Grid container className={classes.form}>
      <Grid item xs={3} className={classes.item}>
        <PayrollNameFilterSuggestionField
          value={filterTextFieldValue('name')}
          onApplyFilter={onChangeStringFilter}
        />
      </Grid>
      <Grid item xs={3} className={classes.item}>
        <PublishedComponent
          pubRef="contributionPlan.PaymentPlanPicker"
          filters={filters}
          value={filterValue('paymentPlan_Id')}
          onChange={(paymentPlan) => onChangeFilters([
            {
              id: 'paymentPlan_Id',
              value: paymentPlan,
              filter: `paymentPlan_Id: "${paymentPlan?.id && decodeId(paymentPlan.id)}"`,
            },
          ])}
        />
      </Grid>
      <Grid item xs={3} className={classes.item}>
        <PublishedComponent
          pubRef="payroll.PaymentPointPicker"
          withLabel
          withPlaceholder
          filters={filters}
          value={filterValue('paymentPoint_Id')}
          onChange={(paymentPoint) => onChangeFilters([
            {
              id: 'paymentPoint_Id',
              value: paymentPoint,
              filter: `paymentPoint_Id: "${paymentPoint?.id && decodeId(paymentPoint.id)}"`,
            },
          ])}
        />
      </Grid>
      <Grid item xs={3} className={classes.item}>
        <PublishedComponent
          pubRef="paymentCycle.PaymentCyclePicker"
          withLabel
          withPlaceholder
          filters={filters}
          value={filterValue('paymentCycle_Id')}
          onChange={(paymentCycle) => onChangeFilters([
            {
              id: 'paymentCycle_Id',
              value: paymentCycle,
              filter: `paymentCycle_Id: "${paymentCycle?.id && decodeId(paymentCycle.id)}"`,
            },
          ])}
        />
      </Grid>
      <Grid item xs={2} className={classes.item}>
        <PayrollStatusPicker
          withNull
          nullLabel={formatMessage('any')}
          label={formatMessage('paymentMethod')}
          value={filterValue('status')}
          readOnly={statusReadOnly}
          onChange={(value) => onChangeFilters([
            {
              id: 'status',
              value,
              filter: value ? `status: ${value}` : EMPTY_STRING,
            },
          ])}
        />
      </Grid>
      <Grid item xs={2} className={classes.item}>
        <PaymentMethodPicker
          withNull
          nullLabel={formatMessage('any')}
          label={formatMessage('payroll.paymentMethod')}
          value={filterValue('paymentMethod')}
          onChange={(value) => onChangeFilters([
            {
              id: 'paymentMethod',
              value,
              filter: `paymentMethod: "${value}"`,
            },
          ])}
        />
      </Grid>
      <ControlledField
        module="payroll"
        id="payrollFilter.showHistory"
        field={(
          <Grid item xs={12} className={classes.item}>
            <FormControlLabel
              control={(
                <Checkbox
                  color="primary"
                  checked={filters?.isDeleted?.value}
                  onChange={() => onChangeFilters([
                    {
                      id: 'isDeleted',
                      value: !filters?.isDeleted?.value,
                      filter: `isDeleted: ${!filters?.isDeleted?.value}`,
                    },
                  ])}
                />
                )}
              label={formatMessage('tooltip.isDeleted')}
            />
          </Grid>
          )}
      />
    </Grid>
  );
}

export default PayrollFilter;
