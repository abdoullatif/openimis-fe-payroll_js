/* eslint-disable react/jsx-no-useless-fragment */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/jsx-props-no-spreading */
import React from "react";
import { injectIntl } from "react-intl";
import {
  PublishedComponent,
  TextInput,
  NumberInput,
  SelectInput,
  useModulesManager,
  useTranslations,
  CustomFilterTypeStatusPicker,
  CustomFilterFieldStatusPicker,
  CustomFilterFieldValueInput,
  shouldUseCustomFilterValueSuggestions,
} from "@openimis/fe-core";
import { Grid } from "@material-ui/core";
import { withTheme, withStyles } from "@material-ui/core/styles";
import { connect } from "react-redux";
import {
  MODULE_NAME,
  BOOLEAN,
  INTEGER,
  STRING,
  CLEARED_STATE_FILTER,
  DATE,
  BOOL_OPTIONS,
} from "../../constants";

const styles = (theme) => ({
  item: theme.paper.item,
});

const CUSTOM_FILTER_MODULE_NAME = "social_protection";
const CUSTOM_FILTER_OBJECT_TYPE = "BenefitPlan";

function AdvancedFiltersRowValue({
  classes,
  customFilters,
  currentFilter,
  setCurrentFilter,
  index,
  filters,
  setFilters,
  readOnly,
  benefitPlanId = null,
}) {
  const onAttributeChange = (attribute) => (incoming) => {
    setFilters((prevFilters) => {
      const updatedRows = [...prevFilters];
      const row = { ...(updatedRows[index] ?? {}) };

      if (attribute === 'field') {
        updatedRows[index] = {
          ...row,
          field: incoming.field,
          type: incoming.type,
          referential: incoming.referential,
          typeLocation: incoming.typeLocation,
          filter: '',
          value: '',
        };
      } else if (attribute === 'filter') {
        updatedRows[index] = {
          ...row,
          filter: incoming,
        };
      } else {
        updatedRows[index] = {
          ...row,
          [attribute]: incoming,
        };
      }

      setCurrentFilter(updatedRows[index]);
      return updatedRows;
    });
  };

  const removeFilter = () => {
    const newArray = [...filters];
    newArray.splice(index, 1);
    setFilters(newArray.length === 0 ? [CLEARED_STATE_FILTER] : newArray);
  };

  const renderInputBasedOnType = (type) => {
    const modulesManager = useModulesManager();
    const { formatMessage } = useTranslations(MODULE_NAME, modulesManager);
    const commonProps = {
      module: "payroll",
      label: formatMessage("payroll.advancedFilters.value"),
      value: currentFilter.value,
      onChange: onAttributeChange("value"),
      readOnly,
    };

    switch (type) {
      case BOOLEAN:
        return <SelectInput options={BOOL_OPTIONS} {...commonProps} />;
      case INTEGER:
        if (shouldUseCustomFilterValueSuggestions(currentFilter) && benefitPlanId) {
          return (
            <CustomFilterFieldValueInput
              key={`${currentFilter.field}-${benefitPlanId}`}
              label={commonProps.label}
              value={currentFilter.value}
              onChange={onAttributeChange("value")}
              readOnly={readOnly}
              field={currentFilter.field}
              filterMeta={currentFilter}
              moduleName={CUSTOM_FILTER_MODULE_NAME}
              objectTypeName={CUSTOM_FILTER_OBJECT_TYPE}
              uuidOfObject={benefitPlanId}
              minLength={1}
            />
          );
        }
        return <NumberInput min={0} displayZero {...commonProps} />;
      case STRING:
      default:
        if (currentFilter.field.toLowerCase().includes(DATE)) {
          return <PublishedComponent pubRef="core.DatePicker" {...commonProps} />;
        }
        if (shouldUseCustomFilterValueSuggestions(currentFilter) && benefitPlanId) {
          return (
            <CustomFilterFieldValueInput
              key={`${currentFilter.field}-${benefitPlanId}`}
              label={commonProps.label}
              value={currentFilter.value}
              onChange={onAttributeChange("value")}
              readOnly={readOnly}
              field={currentFilter.field}
              filterMeta={currentFilter}
              moduleName={CUSTOM_FILTER_MODULE_NAME}
              objectTypeName={CUSTOM_FILTER_OBJECT_TYPE}
              uuidOfObject={benefitPlanId}
              minLength={1}
            />
          );
        }
        return <TextInput {...commonProps} />;
    }
  };

  return (
    <Grid
      container
      direction="row"
      className={classes.item}
      style={{ backgroundColor: "#DFEDEF" }}
    >
      {filters.length > 0 && !readOnly ? (
        <div
          style={{
            backgroundColor: "#DFEDEF",
            width: "10px",
            height: "25px",
            marginTop: "25px",
          }}
        >
          <span
            style={{
              transform: "translate(-50%, -50%)",
              fontSize: "16px",
              color: "#006273",
              cursor: "pointer",
            }}
            onClick={removeFilter}
          >
            &#x2716;
          </span>
        </div>
      ) : (
        <></>
      )}
      <Grid item xs={3} className={classes.item}>
        <CustomFilterFieldStatusPicker
          module="payroll"
          label="payroll.advancedFilters.field"
          value={{
            field: currentFilter.field,
            type: currentFilter.type,
            referential: currentFilter.referential,
            typeLocation: currentFilter.typeLocation,
          }}
          onChange={onAttributeChange("field")}
          customFilters={customFilters}
          readOnly={readOnly}
        />
      </Grid>
      {currentFilter.field !== "" ? (
        <Grid item xs={3} className={classes.item}>
          <CustomFilterTypeStatusPicker
            module="payroll"
            label="payroll.advancedFilters.filter"
            value={currentFilter.filter}
            onChange={onAttributeChange("filter")}
            customFilters={customFilters}
            customFilterField={currentFilter.field}
            readOnly={readOnly}
          />
        </Grid>
      ) : (
        <></>
      )}
      {currentFilter.field !== "" && currentFilter.filter !== "" ? (
        <Grid item xs={3} className={classes.item}>
          {renderInputBasedOnType(currentFilter.type)}
        </Grid>
      ) : (
        <></>
      )}
    </Grid>
  );
}

export default injectIntl(
  withTheme(withStyles(styles)(connect(null, null)(AdvancedFiltersRowValue)))
);
