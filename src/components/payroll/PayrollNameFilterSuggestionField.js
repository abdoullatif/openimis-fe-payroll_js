import React, { useCallback } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
  FilterSuggestionsAutocomplete,
  useModulesManager,
  useTranslations,
} from '@openimis/fe-core';
import { fetchPayrollFilterSuggestions } from '../../actions';
import {
  CONTAINS_LOOKUP,
  FILTER_SUGGESTION_DEBOUNCE_MS,
  FILTER_SUGGESTION_MIN_LENGTH,
  MODULE_NAME,
} from '../../constants';

function PayrollNameFilterSuggestionField({
  value,
  onApplyFilter,
  fetchPayrollFilterSuggestions: fetchSuggestions,
}) {
  const modulesManager = useModulesManager();
  const { formatMessage } = useTranslations(MODULE_NAME, modulesManager);

  const fetchOptions = useCallback(
    (search) => fetchSuggestions(search),
    [fetchSuggestions],
  );

  return (
    <FilterSuggestionsAutocomplete
      label={formatMessage('payroll.name')}
      value={value ?? ''}
      onChange={(v) => onApplyFilter('name', v, CONTAINS_LOOKUP)}
      fetchSuggestions={fetchOptions}
      minLength={FILTER_SUGGESTION_MIN_LENGTH}
      debounceMs={FILTER_SUGGESTION_DEBOUNCE_MS}
    />
  );
}

const mapDispatchToProps = (dispatch) => bindActionCreators({
  fetchPayrollFilterSuggestions,
}, dispatch);

export default connect(null, mapDispatchToProps)(PayrollNameFilterSuggestionField);
