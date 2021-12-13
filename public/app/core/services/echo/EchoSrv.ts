import { getEchoSrv, EchoEventType } from '@grafana/runtime';
import { captureException } from '@sentry/browser';
import { PerformanceEvent, PerformanceEventName } from './backends/PerformanceBackend';

export const reportPerformance = (metric: PerformanceEventName | string, value: number) => {
  getEchoSrv().addEvent<PerformanceEvent>({
    type: EchoEventType.Performance,
    payload: {
      name: metric,
      value: value,
    },
  });
};

// Sentry will process the error, adding it's own metadata, applying any sampling rules,
// then push it to EchoSrv as SentryEvent
export const reportError = (error: Error) => captureException(error);
