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

function AdvancedFiltersRowValue({
  classes,
  customFilters,
  currentFilter,
  setCurrentFilter,
  index,
  filters,
  setFilters,
  readOnly,
}) {
  const onAttributeChange = (attribute) => (value) => {
    let updatedFilter = { ...currentFilter };

    if (attribute === "field") {
      updatedFilter = {
        ...{ filter: "", value: "", type: value.type, referential: value.referential, typeLocation: value.typeLocation }
      };
    }

    const attributeValue = attribute === "field" ? value.field : value;
    updatedFilter = {
      ...updatedFilter,
      [attribute]: attributeValue,
      ...(attribute === "filter" && { value: "" }),
    };

    setCurrentFilter(updatedFilter);

    setFilters((prevFilters) => {
      const updatedRows = [...prevFilters];
      updatedRows[index] = { ...updatedFilter };
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

    // Utiliser les pickers du module location
    if (currentFilter.referential === "Location") {
      switch (currentFilter.typeLocation) {
        case "Region":
          return (
            <PublishedComponent
              pubRef="location.LocationPicker"
              {...commonProps}
              locationLevel={0}
            />
          );
        case "District":
          return (
            <PublishedComponent
              pubRef="location.LocationPicker"
              {...commonProps}
              locationLevel={1}
            />
          );
        case "Municipality":
          return (
            <PublishedComponent
              pubRef="location.LocationPicker"
              {...commonProps}
              locationLevel={2}
            />
          );
        case "Village":
          return (
            <PublishedComponent
              pubRef="location.LocationPicker"
              {...commonProps}
              locationLevel={3}
            />
          );
        default:
          return null;
      }
    }

    // Cas normaux
    switch (type) {
      case BOOLEAN:
        return <SelectInput options={BOOL_OPTIONS} {...commonProps} />;
      case INTEGER:
        return <NumberInput min={0} displayZero {...commonProps} />;
      case STRING:
      default:
        if (currentFilter.field.toLowerCase().includes(DATE)) {
          return <PublishedComponent pubRef="core.DatePicker" {...commonProps} />;
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
