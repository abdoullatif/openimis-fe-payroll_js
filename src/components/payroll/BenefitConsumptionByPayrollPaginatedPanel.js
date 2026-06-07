import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useModulesManager, useTranslations } from '@openimis/fe-core';
import { APPROVED_PAYMENTS_PAGE_SIZE, MODULE_NAME } from '../../constants';
import { fetchBenefitConsumptionByPayrollPageThunk } from '../../services/payrollApprovedPaymentModalService';
import ApprovedPaymentsPaginatedList from './ApprovedPaymentsPaginatedList';

function BenefitConsumptionByPayrollPaginatedPanel({
  payrollUuid,
  benefitStatus = null,
  listTitleKey = 'payroll.approvedModal.list.title',
  badgeCount = null,
}) {
  const dispatch = useDispatch();
  const modulesManager = useModulesManager();
  const { formatMessage, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);

  const [items, setItems] = useState([]);
  const [pageInfo, setPageInfo] = useState({});
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const resolvedBadge = badgeCount ?? (
    benefitStatus && statusCounts[benefitStatus] != null
      ? statusCounts[benefitStatus]
      : totalCount
  );

  const loadPage = useCallback((after = null, append = false) => {
    if (!payrollUuid) return Promise.resolve();
    const setBusy = append ? setLoadingMore : setLoading;
    setBusy(true);
    return dispatch(fetchBenefitConsumptionByPayrollPageThunk(payrollUuid, {
      benefitStatus,
      first: APPROVED_PAYMENTS_PAGE_SIZE,
      after,
    }))
      .then((result) => {
        if (!result || result.error) {
          if (!append) {
            setItems([]);
            setTotalCount(0);
            setPageInfo({});
          }
          return;
        }
        setItems((prev) => (append ? [...prev, ...result.items] : result.items));
        setPageInfo(result.pageInfo ?? {});
        setTotalCount(result.totalCount ?? 0);
        setStatusCounts(result.statusCounts ?? {});
      })
      .finally(() => setBusy(false));
  }, [dispatch, payrollUuid, benefitStatus]);

  useEffect(() => {
    setItems([]);
    setPageInfo({});
    setTotalCount(0);
    loadPage();
  }, [loadPage]);

  const onLoadMore = () => {
    if (!pageInfo?.hasNextPage || loadingMore) return;
    loadPage(pageInfo.endCursor, true);
  };

  return (
    <ApprovedPaymentsPaginatedList
      items={items}
      totalCount={totalCount}
      hasNextPage={pageInfo?.hasNextPage}
      loading={loading}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      listTitleKey={listTitleKey}
      badgeCount={resolvedBadge}
      formatMessage={formatMessage}
      formatMessageWithValues={formatMessageWithValues}
    />
  );
}

export default BenefitConsumptionByPayrollPaginatedPanel;
