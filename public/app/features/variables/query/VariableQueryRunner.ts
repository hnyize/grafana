import { merge, Observable, of, Subject, throwError, Unsubscribable } from 'rxjs';
import { catchError, filter, finalize, mergeMap, take, takeUntil } from 'rxjs/operators';
import {
  CoreApp,
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  ScopedVars,
} from '@grafana/data';

import { DashboardVariableIdentifier } from '../state/types';
import { getDashboardVariable, getLastUid } from '../state/selectors';
import { QueryVariableModel, VariableRefresh } from '../types';
import { StoreState, ThunkDispatch } from '../../../types';
import { dispatch, getState } from '../../../store/store';
import { getTemplatedRegex } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { QueryRunners } from './queryRunners';
import { runRequest } from '../../query/state/runRequest';
import { toMetricFindValues, updateOptionsState, validateVariableSelection } from './operators';

interface UpdateOptionsArgs {
  identifier: DashboardVariableIdentifier;
  datasource: DataSourceApi;
  searchFilter?: string;
}

export interface UpdateOptionsResults {
  state: LoadingState;
  identifier: DashboardVariableIdentifier;
  error?: any;
  cancelled?: boolean;
}

interface VariableQueryRunnerArgs {
  dispatch: ThunkDispatch;
  getState: () => StoreState;
  getDashboardVariable: typeof getDashboardVariable;
  getTemplatedRegex: typeof getTemplatedRegex;
  getTimeSrv: typeof getTimeSrv;
  queryRunners: QueryRunners;
  runRequest: typeof runRequest;
}

export class VariableQueryRunner {
  private readonly updateOptionsRequests: Subject<UpdateOptionsArgs>;
  private readonly updateOptionsResults: Subject<UpdateOptionsResults>;
  private readonly cancelRequests: Subject<{ identifier: DashboardVariableIdentifier }>;
  private readonly subscription: Unsubscribable;

  constructor(
    private dependencies: VariableQueryRunnerArgs = {
      dispatch,
      getState,
      getDashboardVariable,
      getTemplatedRegex,
      getTimeSrv,
      queryRunners: new QueryRunners(),
      runRequest,
    }
  ) {
    this.updateOptionsRequests = new Subject<UpdateOptionsArgs>();
    this.updateOptionsResults = new Subject<UpdateOptionsResults>();
    this.cancelRequests = new Subject<{ identifier: DashboardVariableIdentifier }>();
    this.onNewRequest = this.onNewRequest.bind(this);
    this.subscription = this.updateOptionsRequests.subscribe(this.onNewRequest);
  }

  queueRequest(args: UpdateOptionsArgs): void {
    this.updateOptionsRequests.next(args);
  }

  getResponse(identifier: DashboardVariableIdentifier): Observable<UpdateOptionsResults> {
    return this.updateOptionsResults.asObservable().pipe(filter((result) => result.identifier === identifier));
  }

  cancelRequest(identifier: DashboardVariableIdentifier): void {
    this.cancelRequests.next({ identifier });
  }

  destroy(): void {
    this.subscription.unsubscribe();
  }

  private onNewRequest(args: UpdateOptionsArgs): void {
    const { datasource, identifier, searchFilter } = args;
    try {
      const {
        dispatch,
        runRequest,
        getTemplatedRegex: getTemplatedRegexFunc,
        getDashboardVariable,
        queryRunners,
        getTimeSrv,
        getState,
      } = this.dependencies;

      const beforeUid = getLastUid(getState());

      this.updateOptionsResults.next({ identifier, state: LoadingState.Loading });

      const variable = getDashboardVariable<QueryVariableModel>(identifier, getState());
      const timeSrv = getTimeSrv();
      const runnerArgs = { variable, datasource, searchFilter, timeSrv, runRequest };
      const runner = queryRunners.getRunnerForDatasource(datasource);
      const target = runner.getTarget({ datasource, variable });
      const request = this.getRequest(variable, args, target);

      runner
        .runRequest(runnerArgs, request)
        .pipe(
          filter(() => {
            // Lets check if we started another batch during the execution of the observable. If so we just want to abort the rest.
            const afterUid = getLastUid(getState());

            return beforeUid === afterUid;
          }),
          filter((data) => data.state === LoadingState.Done || data.state === LoadingState.Error), // we only care about done or error for now
          take(1), // take the first result, using first caused a bug where it in some situations throw an uncaught error because of no results had been received yet
          mergeMap((data: PanelData) => {
            if (data.state === LoadingState.Error) {
              return throwError(() => data.error);
            }

            return of(data);
          }),
          toMetricFindValues(),
          updateOptionsState({ variable, dispatch, getTemplatedRegexFunc }),
          validateVariableSelection({ variable, dispatch, searchFilter }),
          takeUntil(
            merge(this.updateOptionsRequests, this.cancelRequests).pipe(
              filter((args) => {
                let cancelRequest = false;

                if (args.identifier.id === identifier.id) {
                  cancelRequest = true;
                  this.updateOptionsResults.next({ identifier, state: LoadingState.Loading, cancelled: cancelRequest });
                }

                return cancelRequest;
              })
            )
          ),
          catchError((error) => {
            if (error.cancelled) {
              return of({});
            }

            this.updateOptionsResults.next({ identifier, state: LoadingState.Error, error });
            return throwError(() => error);
          }),
          finalize(() => {
            this.updateOptionsResults.next({ identifier, state: LoadingState.Done });
          })
        )
        .subscribe();
    } catch (error) {
      this.updateOptionsResults.next({ identifier, state: LoadingState.Error, error });
    }
  }

  private getRequest(variable: QueryVariableModel, args: UpdateOptionsArgs, target: DataQuery) {
    const { searchFilter } = args;
    const variableAsVars = { variable: { text: variable.current.text, value: variable.current.value } };
    const searchFilterScope = { searchFilter: { text: searchFilter, value: searchFilter } };
    const searchFilterAsVars = searchFilter ? searchFilterScope : {};
    const scopedVars = { ...searchFilterAsVars, ...variableAsVars } as ScopedVars;
    const range =
      variable.refresh === VariableRefresh.onTimeRangeChanged
        ? this.dependencies.getTimeSrv().timeRange()
        : getDefaultTimeRange();

    const request: DataQueryRequest = {
      app: CoreApp.Dashboard,
      requestId: uuidv4(),
      timezone: '',
      range,
      interval: '',
      intervalMs: 0,
      targets: [target],
      scopedVars,
      startTime: Date.now(),
    };

    return request;
  }
}

let singleton: VariableQueryRunner;

export function setVariableQueryRunner(runner: VariableQueryRunner): void {
  singleton = runner;
}

export function getVariableQueryRunner(): VariableQueryRunner {
  return singleton;
}
