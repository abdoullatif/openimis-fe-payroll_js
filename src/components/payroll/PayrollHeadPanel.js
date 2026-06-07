/* eslint-disable camelcase */
import React from 'react';
import { injectIntl } from 'react-intl';
import { Grid, Divider, Typography } from '@material-ui/core';
import { withStyles, withTheme } from '@material-ui/core/styles';
import {
  formatMessage,
  FormPanel,
  PublishedComponent,
  TextInput,
  withModulesManager,
  FormattedMessage,
} from '@openimis/fe-core';
import AdvancedFiltersDialog from './AdvancedFiltersDialog';
import { CLEARED_STATE_FILTER } from '../../constants';
import { resolveBenefitPlanFromPaymentPlan } from '../../utils/advanced-filters-utils';
import PayrollStatusPicker from './PayrollStatusPicker';
import PaymentMethodPicker from '../../pickers/PaymentMethodPicker';

const styles = (theme) => ({
  tableTitle: theme.table.title,
  item: theme.paper.item,
  fullHeight: {
    height: '100%',
  },
});

class PayrollHeadPanel extends FormPanel {
  constructor(props) {
    super(props);
    this.state = {
      appliedCustomFilters: [],
      appliedFiltersRowStructure: [],
    };
  }

  componentDidMount() {
    this.setStateFromProps(this.props);
  }

  componentDidUpdate(prevProps) {
    super.componentDidUpdate(prevProps);
    if (prevProps.edited?.jsonExt !== this.props.edited?.jsonExt) {
      this.setStateFromProps(this.props);
    }
  }

  setStateFromProps = (props) => {
    const { jsonExt } = props?.edited ?? {};
    if (!jsonExt) {
      return;
    }
    const filters = this.getDefaultAppliedCustomFilters(jsonExt);
    this.setState({
      appliedCustomFilters: filters,
      appliedFiltersRowStructure: filters,
    });
  };

  updateJsonExt = (value) => {
    this.updateAttributes({ jsonExt: value });
  };

  /**
   * Désérialise les critères sauvegardés dans jsonExt
   * et restaure les objets complexes (Location, BenefitPlan, etc.)
   */
  getDefaultAppliedCustomFilters = (jsonExt) => {
    if (!jsonExt) return [];

    try {
      const jsonData = JSON.parse(jsonExt);
      const advancedCriteria = jsonData.advanced_criteria || [];

      return advancedCriteria.map((criteria) => {
        const {
          amount,
          field,
          filter,
          type,
          referential,
          typeLocation,
          value,
          custom_filter_condition,
        } = criteria;

        let parsedValue = value;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              parsedValue = JSON.parse(trimmed);
            } catch (e) {
              parsedValue = value;
            }
          } else {
            parsedValue = value;
          }
        }

        return {
          amount: amount ?? '',
          field: field ?? '',
          filter: filter ?? '',
          type: type ?? '',
          referential: referential ?? '',
          typeLocation: typeLocation ?? '',
          value: parsedValue ?? '',
          custom_filter_condition:
            custom_filter_condition ??
            `${field}__${filter}__${type}=${parsedValue}`,
        };
      });
    } catch (error) {
      console.warn('Erreur parsing advanced_criteria :', error);
      return [];
    }
  };

  setAppliedCustomFilters = (appliedCustomFilters) => {
    this.setState({ appliedCustomFilters });
  };

  setAppliedFiltersRowStructure = (appliedFiltersRowStructure) => {
    this.setState({ appliedFiltersRowStructure });
  };

  render() {
    const {
      edited,
      classes,
      intl,
      readOnly,
      isPayrollFromFailedInvoices,
      benefitPlanId,
    } = this.props;
    const payroll = { ...edited };
    const { appliedCustomFilters, appliedFiltersRowStructure } = this.state;

    return (
      <>
        <Grid container className={classes.item}>
          <Grid item xs={3} className={classes.item}>
            <TextInput
              module="payroll"
              label={formatMessage(intl, 'payroll', 'paymentPoint.name')}
              value={payroll?.name}
              required
              onChange={(name) => this.updateAttribute('name', name)}
              // En mode "à partir des factures échouées", on veut pouvoir modifier le nom
              readOnly={readOnly}
            />
          </Grid>

          <Grid item xs={3} className={classes.item}>
            <PublishedComponent
              pubRef="contributionPlan.PaymentPlanPicker"
              required
              filterLabels={false}
              onChange={(paymentPlan) =>
                this.updateAttribute('paymentPlan', paymentPlan)
              }
              value={payroll?.paymentPlan}
              readOnly={readOnly}
              benefitPlanId={benefitPlanId}
            />
          </Grid>

          <Grid item xs={3} className={classes.item}>
            <PublishedComponent
              pubRef="payroll.PaymentPointPicker"
              withLabel
              withPlaceholder
              filterLabels={false}
              onChange={(paymentPoint) =>
                this.updateAttribute('paymentPoint', paymentPoint)
              }
              value={payroll?.paymentPoint}
              readOnly={readOnly}
            />
          </Grid>

          <Grid item xs={3} className={classes.item}>
            <PublishedComponent
              pubRef="paymentCycle.PaymentCyclePicker"
              withLabel
              required
              withPlaceholder
              filterLabels={false}
              onChange={(paymentCycle) =>
                this.updateAttribute('paymentCycle', paymentCycle)
              }
              value={payroll?.paymentCycle}
              // En mode "à partir des factures échouées", on veut pouvoir modifier le cycle
              readOnly={readOnly}
            />
          </Grid>

          {readOnly && !isPayrollFromFailedInvoices && (
            <Grid item xs={3} className={classes.item}>
              <PayrollStatusPicker
                required
                withNull={false}
                readOnly={readOnly}
                value={payroll?.status}
              />
            </Grid>
          )}

          <Grid item xs={3} className={classes.item}>
            <PaymentMethodPicker
              required
              withNull={false}
              readOnly={readOnly}
              value={payroll?.paymentMethod}
              onChange={(paymentMethod) =>
                this.updateAttribute('paymentMethod', paymentMethod)
              }
              label={formatMessage(intl, 'payroll', 'paymentMethod')}
            />
          </Grid>

          <Grid item xs={3} className={classes.item}>
            <PublishedComponent
              pubRef="core.DatePicker"
              module="payroll"
              label="dateValidFrom"
              required
              value={payroll.dateValidFrom || null}
              onChange={(v) => this.updateAttribute('dateValidFrom', v)}
              readOnly={readOnly}
            />
          </Grid>

          <Grid item xs={3} className={classes.item}>
            <PublishedComponent
              pubRef="core.DatePicker"
              module="payroll"
              label="dateValidTo"
              required
              value={payroll.dateValidTo || null}
              onChange={(v) => this.updateAttribute('dateValidTo', v)}
              readOnly={readOnly}
            />
          </Grid>
        </Grid>

        <Divider />

        {!isPayrollFromFailedInvoices && (
          <>
            <Typography>
              <div className={classes.item}>
                <FormattedMessage
                  module="contributionPlan"
                  id="paymentPlan.advancedCriteria"
                />
              </div>
            </Typography>
            {!readOnly && (
              <div className={classes.item}>
                <FormattedMessage
                  module="contributionPlan"
                  id="paymentPlan.advancedCriteria.tip"
                />
              </div>
            )}
            <Divider />
            <Grid container className={classes.item}>
              <AdvancedFiltersDialog
                object={resolveBenefitPlanFromPaymentPlan(payroll?.paymentPlan)}
                objectToSave={payroll}
                moduleName="social_protection"
                objectType="BenefitPlan"
                setAppliedCustomFilters={this.setAppliedCustomFilters}
                appliedCustomFilters={appliedCustomFilters}
                appliedFiltersRowStructure={appliedFiltersRowStructure}
                setAppliedFiltersRowStructure={
                  this.setAppliedFiltersRowStructure
                }
                updateAttributes={this.updateJsonExt}
                getDefaultAppliedCustomFilters={(jsonExt) =>
                  this.getDefaultAppliedCustomFilters(jsonExt ?? payroll.jsonExt)
                }
                readOnly={readOnly}
                edited={this.props.edited}
              />
            </Grid>
            <Divider />
          </>
        )}
      </>
    );
  }
}

export default withModulesManager(
  injectIntl(withTheme(withStyles(styles)(PayrollHeadPanel))),
);
