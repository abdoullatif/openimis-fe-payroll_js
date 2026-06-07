/* eslint-disable no-unused-vars */
/* eslint-disable react/jsx-no-useless-fragment */
/* eslint-disable no-prototype-builtins */
import React, { useEffect, useRef, useState } from 'react';
import { injectIntl } from 'react-intl';
import Button from '@material-ui/core/Button';
import {
  formatMessage,
  fetchCustomFilter,
} from '@openimis/fe-core';
import { withTheme, withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import AddCircle from '@material-ui/icons/Add';
import AdvancedFiltersRowValue from './AdvancedFiltersRowValue';
import { CLEARED_STATE_FILTER } from '../../constants';
import {
  getBenefitPlanUuid,
  resolveBenefitPlanFromPaymentPlan,
} from '../../utils/advanced-filters-utils';

const styles = (theme) => ({
  item: theme.paper.item,
});

const normalizeFilterValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    return value.name || value.code || value.id || value.value || '';
  }
  return String(value);
};

const buildCustomFilterCondition = ({ field, filter, value, type }) => {
  if (!field || !filter) return null;
  const normalizedValue = normalizeFilterValue(value);
  if (!normalizedValue) return null;
  const valueType = type || 'string';
  return `${field}__${filter}__${valueType}=${normalizedValue}`;
};

const buildSavedCriteriaRows = (filters) => filters
  .filter(({ field, filter, value }) => field && filter && normalizeFilterValue(value) !== '')
  .map(({ filter, value, field, type, referential, typeLocation, amount }) => {
    let safeValue = value ?? '';
    let resolvedTypeLocation = typeLocation;

    if (typeof safeValue === 'object' && safeValue !== null) {
      try {
        safeValue = JSON.stringify(safeValue);
      } catch (e) {
        safeValue = '[Unserializable Object]';
      }
    }

    if (referential === 'Location' && !resolvedTypeLocation && value?.__typename) {
      resolvedTypeLocation = value.__typename.replace('GQLType', '');
    }

    return {
      amount: amount ?? '',
      field,
      filter,
      type,
      referential,
      typeLocation: resolvedTypeLocation,
      value: safeValue,
      custom_filter_condition: buildCustomFilterCondition({ field, filter, value, type }),
    };
  })
  .filter((entry) => !!entry.custom_filter_condition);

const getCriteriaFromJsonExt = (jsonExt) => {
  try {
    const data = JSON.parse(jsonExt || '{}');
    const criteria = data?.advanced_criteria;
    if (Array.isArray(criteria)) return criteria;
    if (criteria && typeof criteria === 'object') {
      return criteria.ACTIVE || criteria.active || [];
    }
    const byStatus = data?.advanced_criteria_by_status;
    if (byStatus?.ACTIVE) return byStatus.ACTIVE;
    return [];
  } catch {
    return [];
  }
};

const mergeCriteriaIntoJsonExt = (inputJsonExt, savedRows) => {
  const existingData = JSON.parse(inputJsonExt || '{}');
  existingData.advanced_criteria = savedRows;
  existingData.advanced_criteria_by_status = { ACTIVE: savedRows };
  return JSON.stringify(existingData);
};

const criteriaRowsEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function AdvancedFiltersDialog({
  intl,
  classes,
  object,
  objectToSave,
  fetchCustomFilter,
  customFilters,
  moduleName,
  objectType,
  setAppliedCustomFilters,
  setAppliedFiltersRowStructure,
  updateAttributes,
  getDefaultAppliedCustomFilters,
  readOnly,
  additionalParams,
  confirmed,
}) {
  const benefitPlan = object ?? resolveBenefitPlanFromPaymentPlan(objectToSave?.paymentPlan);
  const benefitPlanId = getBenefitPlanUuid(benefitPlan);

  const [currentFilter, setCurrentFilter] = useState({
    field: '', filter: '', type: '', value: '', amount: '', referential: '', typeLocation: '',
  });
  const [filters, setFilters] = useState(() => getDefaultAppliedCustomFilters(objectToSave?.jsonExt));
  const skipNextSyncRef = useRef(false);

  useEffect(() => {
    const parsed = getDefaultAppliedCustomFilters(objectToSave?.jsonExt);
    skipNextSyncRef.current = true;
    setFilters(parsed.length > 0 ? parsed : []);
  }, [objectToSave?.jsonExt]);

  useEffect(() => {
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    if (!benefitPlanId) {
      return;
    }

    const savedRows = buildSavedCriteriaRows(filters);
    const currentRows = getCriteriaFromJsonExt(objectToSave?.jsonExt);
    if (criteriaRowsEqual(savedRows, currentRows)) {
      return;
    }

    const jsonExt = mergeCriteriaIntoJsonExt(objectToSave?.jsonExt, savedRows);
    updateAttributes(jsonExt);
    setAppliedFiltersRowStructure(savedRows);
    setAppliedCustomFilters(JSON.stringify(savedRows));
  }, [filters, benefitPlanId]);

  const createParams = (moduleName, objectTypeName, uuidOfObject = null, additionalParams = null) => {
    const params = [
      `moduleName: "${moduleName}"`,
      `objectTypeName: "${objectTypeName}"`,
    ];
    if (uuidOfObject) {
      params.push(`uuidOfObject: "${uuidOfObject}"`);
    }
    if (additionalParams) {
      params.push(`additionalParams: ${JSON.stringify(JSON.stringify(additionalParams))}`);
    }
    return params;
  };

  const fetchFilters = (params) => fetchCustomFilter(params);

  const handleRemoveFilter = () => {
    setCurrentFilter(CLEARED_STATE_FILTER);
    setAppliedFiltersRowStructure([]);
    setFilters([]);
    const clearedJsonExt = mergeCriteriaIntoJsonExt(objectToSave?.jsonExt, []);
    updateAttributes(clearedJsonExt);
    setAppliedCustomFilters(JSON.stringify([]));
  };

  const handleAddFilter = () => {
    setCurrentFilter(CLEARED_STATE_FILTER);
    setFilters([...filters, CLEARED_STATE_FILTER]);
  };

  useEffect(() => {
    if (!benefitPlanId) return;
    const paramsToFetchFilters = createParams(
      moduleName,
      objectType,
      benefitPlanId,
      additionalParams,
    );
    fetchFilters(paramsToFetchFilters);
  }, [benefitPlanId, moduleName, objectType]);

  return (
    <>
      {filters.map((filter, index) => (
        <AdvancedFiltersRowValue
          key={`criterion-row-${filter.field}-${index}`}
          customFilters={customFilters}
          currentFilter={filter}
          setCurrentFilter={setCurrentFilter}
          index={index}
          filters={filters}
          setFilters={setFilters}
          readOnly={readOnly || confirmed}
          benefitPlanId={benefitPlanId}
        />
      ))}
      {!readOnly && !confirmed ? (
        <div style={{ backgroundColor: '#DFEDEF', paddingLeft: '10px', paddingBottom: '10px' }}>
          <AddCircle
            style={{
              border: 'thin solid',
              borderRadius: '40px',
              width: '16px',
              height: '16px',
              cursor: 'pointer',
            }}
            onClick={handleAddFilter}
            disabled={readOnly || !benefitPlanId}
          />
          <Button
            onClick={handleAddFilter}
            variant="outlined"
            style={{
              border: '0px',
              marginBottom: '6px',
              fontSize: '0.8rem',
            }}
            disabled={readOnly || !benefitPlanId}
          >
            {formatMessage(intl, 'payroll', 'payroll.advancedFilters.button.addFilters')}
          </Button>
        </div>
      ) : null}

      <div style={{ clear: 'both', paddingTop: 8 }}>
        {!readOnly && !confirmed ? (
          <div style={{ float: 'left' }}>
            <Button
              onClick={handleRemoveFilter}
              variant="outlined"
              style={{ border: '0px' }}
              disabled={filters.length === 0}
            >
              {formatMessage(intl, 'payroll', 'payroll.advancedFilters.button.clearAllFilters')}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}

const mapStateToProps = (state) => ({
  rights:
    !!state.core && !!state.core.user && !!state.core.user.i_user
      ? state.core.user.i_user.rights
      : [],
  confirmed: state.core.confirmed,
  fetchingCustomFilters: state.core.fetchingCustomFilters,
  errorCustomFilters: state.core.errorCustomFilters,
  fetchedCustomFilters: state.core.fetchedCustomFilters,
  customFilters: state.core.customFilters,
});

const mapDispatchToProps = (dispatch) =>
  bindActionCreators(
    {
      fetchCustomFilter,
    },
    dispatch,
  );

export default injectIntl(
  withTheme(withStyles(styles)(connect(mapStateToProps, mapDispatchToProps)(AdvancedFiltersDialog))),
);
