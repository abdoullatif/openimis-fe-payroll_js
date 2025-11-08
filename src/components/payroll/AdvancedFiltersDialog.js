/* eslint-disable no-unused-vars */
/* eslint-disable react/jsx-no-useless-fragment */
/* eslint-disable no-prototype-builtins */
import React, { useEffect, useState } from 'react';
import { injectIntl } from 'react-intl';
import Button from '@material-ui/core/Button';
import {
  decodeId,
  formatMessage,
  fetchCustomFilter,
} from '@openimis/fe-core';
import { withTheme, withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import AddCircle from '@material-ui/icons/Add';
import _ from 'lodash';
import AdvancedFiltersRowValue from './AdvancedFiltersRowValue';
import { BENEFIT_PLAN, CLEARED_STATE_FILTER } from '../../constants';
import { isBase64Encoded } from '../../utils/advanced-filters-utils';

const styles = (theme) => ({
  item: theme.paper.item,
});

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
  appliedFiltersRowStructure,
  setAppliedFiltersRowStructure,
  updateAttributes,
  getDefaultAppliedCustomFilters,
  readOnly,
  additionalParams,
  confirmed,
  edited,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentFilter, setCurrentFilter] = useState({
    field: '', filter: '', type: '', value: '', amount: '', referential: '', typeLocation: '',
  });
  const [filters, setFilters] = useState(getDefaultAppliedCustomFilters(objectToSave.jsonExt));

  useEffect(() => {
    setFilters(getDefaultAppliedCustomFilters(objectToSave.jsonExt));
  }, [objectToSave.jsonExt]);

  useEffect(() => {}, [edited]);

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

  const handleClose = () => {
    setCurrentFilter(CLEARED_STATE_FILTER);
  };

  const handleRemoveFilter = () => {
    setCurrentFilter(CLEARED_STATE_FILTER);
    setAppliedFiltersRowStructure([CLEARED_STATE_FILTER]);
    setFilters([]);
  };

  const handleAddFilter = () => {
    setCurrentFilter(CLEARED_STATE_FILTER);
    setFilters([...filters, CLEARED_STATE_FILTER]);
  };

  /**
   * Met à jour le jsonExt du BenefitPlan
   */
  function updateJsonExt(inputJsonExt, outputFilters) {
    const existingData = JSON.parse(inputJsonExt || '{}');
    if (!existingData.hasOwnProperty('advanced_criteria')) {
      existingData.advanced_criteria = [];
    }
    const filterData = JSON.parse(outputFilters);
    existingData.advanced_criteria = filterData;
    return JSON.stringify(existingData);
  }

  /**
   * Sauvegarde des filtres appliqués
   * Sérialisation correcte des objets Location (ou autres objets complexes)
   */
  const saveCriteria = () => {
    setAppliedFiltersRowStructure(filters);

    const outputFilters = JSON.stringify(
      filters.map(({ filter, value, field, type, referential, typeLocation, amount }) => {
        let safeValue = value ?? '';

        // Sérialisation des objets (Locations, BenefitPlan, etc.)
        if (typeof safeValue === 'object' && safeValue !== null) {
          try {
            safeValue = JSON.stringify(safeValue);
          } catch (e) {
            safeValue = '[Unserializable Object]';
          }
        }

        // Détection automatique du type de localité si non précisé
        if (referential === 'Location' && !typeLocation && value?.__typename) {
          typeLocation = value.__typename.replace('GQLType', '');
        }

        return {
          amount: amount ?? '',
          field,
          filter,
          type,
          referential,
          typeLocation,
          value: safeValue,
          custom_filter_condition: `${field}__${filter}__${type}=${safeValue}`,
        };
      })
    );

    const jsonExt = updateJsonExt(objectToSave.jsonExt, outputFilters);
    updateAttributes(jsonExt);
    setAppliedCustomFilters(outputFilters);
    handleClose();
  };

  useEffect(() => {
    if (object && _.isEmpty(object) === false) {
      let paramsToFetchFilters = [];
      if (objectType === BENEFIT_PLAN) {
        paramsToFetchFilters = createParams(
          moduleName,
          objectType,
          isBase64Encoded(object.id) ? decodeId(object.id) : object.id,
          additionalParams,
        );
      } else {
        paramsToFetchFilters = createParams(
          moduleName,
          objectType,
          additionalParams,
        );
      }
      fetchFilters(paramsToFetchFilters);
    }
  }, [object]);

  return (
    <>
      {filters.map((filter, index) => (
        <AdvancedFiltersRowValue
          key={index}
          customFilters={customFilters}
          currentFilter={filter}
          setCurrentFilter={setCurrentFilter}
          index={index}
          filters={filters}
          setFilters={setFilters}
          readOnly={readOnly || confirmed}
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
            disabled={readOnly || confirmed}
          />
          <Button
            onClick={handleAddFilter}
            variant="outlined"
            style={{
              border: '0px',
              marginBottom: '6px',
              fontSize: '0.8rem',
            }}
            disabled={readOnly || confirmed}
          >
            {formatMessage(intl, 'payroll', 'payroll.advancedFilters.button.addFilters')}
          </Button>
        </div>
      ) : null}

      <div>
        {!readOnly && !confirmed ? (
          <>
            <div style={{ float: 'left' }}>
              <Button
                onClick={handleRemoveFilter}
                variant="outlined"
                style={{
                  border: '0px',
                }}
              >
                {formatMessage(intl, 'payroll', 'payroll.advancedFilters.button.clearAllFilters')}
              </Button>
            </div>
            <div
              style={{
                float: 'right',
                paddingRight: '16px',
              }}
            >
              <Button
                onClick={saveCriteria}
                variant="contained"
                color="primary"
                autoFocus
                disabled={!object || confirmed || readOnly}
              >
                {formatMessage(intl, 'payroll', 'payroll.advancedFilters.button.filter')}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

const mapStateToProps = (state, props) => ({
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
