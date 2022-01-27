import { AnyAction } from 'redux';

import { getPreloadedState, getTemplatingRootReducer, TemplatingReducerType } from './helpers';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { createCustomVariableAdapter } from '../custom/adapter';
import { createTextBoxVariableAdapter } from '../textbox/adapter';
import { createConstantVariableAdapter } from '../constant/adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import {
  cancelVariables,
  changeVariableMultiValue,
  cleanUpVariables,
  fixSelectedInconsistency,
  initDashboardTemplating,
  isVariableUrlValueDifferentFromCurrent,
  processVariables,
  validateVariableSelectionState,
} from './actions';
import {
  addVariable,
  changeVariableProp,
  removeVariable,
  setCurrentVariableValue,
  variableStateCompleted,
  variableStateFetching,
  variableStateNotStarted,
} from './sharedReducer';
import {
  constantBuilder,
  customBuilder,
  datasourceBuilder,
  queryBuilder,
  textboxBuilder,
} from '../shared/testing/builders';
import { changeVariableName } from '../editor/actions';
import {
  changeVariableNameFailed,
  changeVariableNameSucceeded,
  cleanEditorState,
  setIdInEditor,
} from '../editor/reducer';
import { variablesClearTransaction, variablesInitTransaction } from './transactionReducer';
import { cleanPickerState } from '../pickers/OptionsPicker/reducer';
import { cleanVariables } from './variablesReducer';
import { ConstantVariableModel, VariableRefresh } from '../types';
import { updateVariableOptions } from '../query/reducer';
import { setVariableQueryRunner, VariableQueryRunner } from '../query/VariableQueryRunner';
import * as runtime from '@grafana/runtime';
import { LoadingState } from '@grafana/data';
import { toAsyncOfResult } from '../../query/state/DashboardQueryRunner/testHelpers';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, NEW_VARIABLE_ID } from '../constants';
import { toUidAction } from './dashboardVariablesReducer';
import { toDashboardVariableIdentifier, toVariablePayload } from '../utils';

variableAdapters.setInit(() => [
  createQueryVariableAdapter(),
  createCustomVariableAdapter(),
  createTextBoxVariableAdapter(),
  createConstantVariableAdapter(),
]);

const metricFindQuery = jest
  .fn()
  .mockResolvedValueOnce([{ text: 'responses' }, { text: 'timers' }])
  .mockResolvedValue([{ text: '200' }, { text: '500' }]);
const getMetricSources = jest.fn().mockReturnValue([]);
const getDatasource = jest.fn().mockResolvedValue({ metricFindQuery });

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  getTimeSrv: () => ({
    timeRange: jest.fn().mockReturnValue(undefined),
  }),
}));

runtime.setDataSourceSrv({
  get: getDatasource,
  getList: getMetricSources,
} as any);

describe('shared actions', () => {
  describe('when initDashboardTemplating is dispatched', () => {
    it('then correct actions are dispatched', () => {
      const uid = 'uid';
      const query = queryBuilder().build();
      const constant = constantBuilder().build();
      const datasource = datasourceBuilder().build();
      const custom = customBuilder().build();
      const textbox = textboxBuilder().build();
      const list = [query, constant, datasource, custom, textbox];
      const dashboard: any = { templating: { list } };

      reduxTester<TemplatingReducerType>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating(uid, dashboard))
        .thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
          expect(dispatchedActions.length).toEqual(8);
          expect(dispatchedActions[0]).toEqual(
            toUidAction(uid, addVariable(toVariablePayload(query, { global: false, index: 0, model: query })))
          );
          expect(dispatchedActions[1]).toEqual(
            toUidAction(uid, addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })))
          );
          expect(dispatchedActions[2]).toEqual(
            toUidAction(uid, addVariable(toVariablePayload(custom, { global: false, index: 2, model: custom })))
          );
          expect(dispatchedActions[3]).toEqual(
            toUidAction(uid, addVariable(toVariablePayload(textbox, { global: false, index: 3, model: textbox })))
          );

          // because uuid are dynamic we need to get the uuid from the resulting state
          // an alternative would be to add our own uuids in the model above instead
          expect(dispatchedActions[4]).toEqual(
            toUidAction(
              uid,
              variableStateNotStarted(
                toVariablePayload({ ...query, id: dispatchedActions[4].payload.action.payload.id })
              )
            )
          );
          expect(dispatchedActions[5]).toEqual(
            toUidAction(
              uid,
              variableStateNotStarted(
                toVariablePayload({ ...constant, id: dispatchedActions[5].payload.action.payload.id })
              )
            )
          );
          expect(dispatchedActions[6]).toEqual(
            toUidAction(
              uid,
              variableStateNotStarted(
                toVariablePayload({ ...custom, id: dispatchedActions[6].payload.action.payload.id })
              )
            )
          );
          expect(dispatchedActions[7]).toEqual(
            toUidAction(
              uid,
              variableStateNotStarted(
                toVariablePayload({ ...textbox, id: dispatchedActions[7].payload.action.payload.id })
              )
            )
          );

          return true;
        });
    });
  });

  describe('when processVariables is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const uid = 'uid';
      const query = queryBuilder().build();
      const constant = constantBuilder().build();
      const datasource = datasourceBuilder().build();
      const custom = customBuilder().build();
      const textbox = textboxBuilder().build();
      const list = [query, constant, datasource, custom, textbox];
      const dashboard: any = { templating: { list } };
      const preloadedState = getPreloadedState(uid, {});
      const locationService: any = { getSearchObject: () => ({}) };
      runtime.setLocationService(locationService);
      const variableQueryRunner: any = {
        cancelRequest: jest.fn(),
        queueRequest: jest.fn(),
        getResponse: () =>
          toAsyncOfResult({ state: LoadingState.Done, identifier: toDashboardVariableIdentifier(query) }),
        destroy: jest.fn(),
      };
      setVariableQueryRunner(variableQueryRunner);

      const tester = await reduxTester<TemplatingReducerType>({ preloadedState })
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(toUidAction(uid, variablesInitTransaction({ uid })))
        .whenActionIsDispatched(initDashboardTemplating(uid, dashboard))
        .whenAsyncActionIsDispatched(processVariables(uid), true);

      await tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
        expect(dispatchedActions.length).toEqual(5);

        expect(dispatchedActions[0]).toEqual(
          toUidAction(
            uid,
            variableStateFetching(toVariablePayload({ ...query, id: dispatchedActions[0].payload.action.payload.id }))
          )
        );

        expect(dispatchedActions[1]).toEqual(
          toUidAction(
            uid,
            variableStateCompleted(
              toVariablePayload({ ...constant, id: dispatchedActions[1].payload.action.payload.id })
            )
          )
        );

        expect(dispatchedActions[2]).toEqual(
          toUidAction(
            uid,
            variableStateCompleted(toVariablePayload({ ...custom, id: dispatchedActions[2].payload.action.payload.id }))
          )
        );

        expect(dispatchedActions[3]).toEqual(
          toUidAction(
            uid,
            variableStateCompleted(
              toVariablePayload({ ...textbox, id: dispatchedActions[3].payload.action.payload.id })
            )
          )
        );

        expect(dispatchedActions[4]).toEqual(
          toUidAction(
            uid,
            variableStateCompleted(toVariablePayload({ ...query, id: dispatchedActions[4].payload.action.payload.id }))
          )
        );

        return true;
      });
    });

    // Fix for https://github.com/grafana/grafana/issues/28791
    it('fix for https://github.com/grafana/grafana/issues/28791', async () => {
      setVariableQueryRunner(new VariableQueryRunner());
      const uid = 'uid';
      const stats = queryBuilder()
        .withId('stats')
        .withDashboardUid(uid)
        .withName('stats')
        .withQuery('stats.*')
        .withRefresh(VariableRefresh.onDashboardLoad)
        .withCurrent(['response'], ['response'])
        .withMulti()
        .withIncludeAll()
        .build();

      const substats = queryBuilder()
        .withId('substats')
        .withDashboardUid(uid)
        .withName('substats')
        .withQuery('stats.$stats.*')
        .withRefresh(VariableRefresh.onDashboardLoad)
        .withCurrent([ALL_VARIABLE_TEXT], [ALL_VARIABLE_VALUE])
        .withMulti()
        .withIncludeAll()
        .build();

      const list = [stats, substats];
      const dashboard: any = { templating: { list } };
      const query = { orgId: '1', 'var-stats': 'response', 'var-substats': ALL_VARIABLE_TEXT };
      const locationService: any = { getSearchObject: () => query };
      runtime.setLocationService(locationService);
      const preloadedState = getPreloadedState(uid, {});

      const tester = await reduxTester<TemplatingReducerType>({ preloadedState })
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(toUidAction(uid, variablesInitTransaction({ uid })))
        .whenActionIsDispatched(initDashboardTemplating(uid, dashboard))
        .whenAsyncActionIsDispatched(processVariables(uid), true);

      await tester.thenDispatchedActionsShouldEqual(
        toUidAction(uid, variableStateFetching(toVariablePayload(stats))),
        toUidAction(
          uid,
          updateVariableOptions(
            toVariablePayload(stats, { results: [{ text: 'responses' }, { text: 'timers' }], templatedRegex: '' })
          )
        ),
        toUidAction(
          uid,
          setCurrentVariableValue(
            toVariablePayload(stats, {
              option: { text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false },
            })
          )
        ),
        toUidAction(uid, variableStateCompleted(toVariablePayload(stats))),
        toUidAction(
          uid,
          setCurrentVariableValue(
            toVariablePayload(stats, { option: { text: ['response'], value: ['response'], selected: false } })
          )
        ),
        toUidAction(uid, variableStateFetching(toVariablePayload(substats))),
        toUidAction(
          uid,
          updateVariableOptions(
            toVariablePayload(substats, { results: [{ text: '200' }, { text: '500' }], templatedRegex: '' })
          )
        ),
        toUidAction(
          uid,
          setCurrentVariableValue(
            toVariablePayload(substats, {
              option: { text: [ALL_VARIABLE_TEXT], value: [ALL_VARIABLE_VALUE], selected: true },
            })
          )
        ),
        toUidAction(uid, variableStateCompleted(toVariablePayload(substats))),
        toUidAction(
          uid,
          setCurrentVariableValue(
            toVariablePayload(substats, {
              option: { text: [ALL_VARIABLE_TEXT], value: [ALL_VARIABLE_VALUE], selected: false },
            })
          )
        )
      );
    });
  });

  describe('when validateVariableSelectionState is dispatched with a custom variable (no dependencies)', () => {
    describe('and not multivalue', () => {
      it.each`
        withOptions        | withCurrent  | defaultValue | expected
        ${['A', 'B', 'C']} | ${undefined} | ${undefined} | ${'A'}
        ${['A', 'B', 'C']} | ${'B'}       | ${undefined} | ${'B'}
        ${['A', 'B', 'C']} | ${'B'}       | ${'C'}       | ${'B'}
        ${['A', 'B', 'C']} | ${'X'}       | ${undefined} | ${'A'}
        ${['A', 'B', 'C']} | ${'X'}       | ${'C'}       | ${'C'}
        ${undefined}       | ${'B'}       | ${undefined} | ${'should not dispatch setCurrentVariableValue'}
      `('then correct actions are dispatched', async ({ withOptions, withCurrent, defaultValue, expected }) => {
        let custom;
        const uid = 'uid';
        if (!withOptions) {
          custom = customBuilder().withId('0').withDashboardUid(uid).withCurrent(withCurrent).withoutOptions().build();
        } else {
          custom = customBuilder()
            .withId('0')
            .withDashboardUid(uid)
            .withOptions(...withOptions)
            .withCurrent(withCurrent)
            .build();
        }

        const tester = await reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
          )
          .whenAsyncActionIsDispatched(
            validateVariableSelectionState(toDashboardVariableIdentifier(custom), defaultValue),
            true
          );

        await tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
          const expectedActions: AnyAction[] = withOptions
            ? [
                toUidAction(
                  uid,
                  setCurrentVariableValue(
                    toVariablePayload(
                      { type: 'custom', id: '0' },
                      { option: { text: expected, value: expected, selected: false } }
                    )
                  )
                ),
              ]
            : [];
          expect(dispatchedActions).toEqual(expectedActions);
          return true;
        });
      });
    });

    describe('and multivalue', () => {
      it.each`
        withOptions        | withCurrent   | defaultValue | expectedText  | expectedSelected
        ${['A', 'B', 'C']} | ${['B']}      | ${undefined} | ${['B']}      | ${true}
        ${['A', 'B', 'C']} | ${['B']}      | ${'C'}       | ${['B']}      | ${true}
        ${['A', 'B', 'C']} | ${['B', 'C']} | ${undefined} | ${['B', 'C']} | ${true}
        ${['A', 'B', 'C']} | ${['B', 'C']} | ${'C'}       | ${['B', 'C']} | ${true}
        ${['A', 'B', 'C']} | ${['X']}      | ${undefined} | ${'A'}        | ${false}
        ${['A', 'B', 'C']} | ${['X']}      | ${'C'}       | ${'A'}        | ${false}
      `(
        'then correct actions are dispatched',
        async ({ withOptions, withCurrent, defaultValue, expectedText, expectedSelected }) => {
          let custom;
          const uid = 'uid';
          if (!withOptions) {
            custom = customBuilder()
              .withId('0')
              .withDashboardUid(uid)
              .withMulti()
              .withCurrent(withCurrent)
              .withoutOptions()
              .build();
          } else {
            custom = customBuilder()
              .withId('0')
              .withDashboardUid(uid)
              .withMulti()
              .withOptions(...withOptions)
              .withCurrent(withCurrent)
              .build();
          }

          const tester = await reduxTester<TemplatingReducerType>()
            .givenRootReducer(getTemplatingRootReducer())
            .whenActionIsDispatched(
              toUidAction(uid, addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
            )
            .whenAsyncActionIsDispatched(
              validateVariableSelectionState(toDashboardVariableIdentifier(custom), defaultValue),
              true
            );

          await tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
            const expectedActions: AnyAction[] = withOptions
              ? [
                  toUidAction(
                    uid,
                    setCurrentVariableValue(
                      toVariablePayload(
                        { type: 'custom', id: '0' },
                        { option: { text: expectedText, value: expectedText, selected: expectedSelected } }
                      )
                    )
                  ),
                ]
              : [];
            expect(dispatchedActions).toEqual(expectedActions);
            return true;
          });
        }
      );
    });
  });

  describe('changeVariableName', () => {
    describe('when changeVariableName is dispatched with the same name', () => {
      it('then the correct actions are dispatched', () => {
        const uid = 'uid';
        const textbox = textboxBuilder().withId('textbox').withDashboardUid(uid).withName('textbox').build();
        const constant = constantBuilder().withId('constant').withDashboardUid(uid).withName('constant').build();

        reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
          )
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })))
          )
          .whenActionIsDispatched(changeVariableName(toDashboardVariableIdentifier(constant), constant.name), true)
          .thenDispatchedActionsShouldEqual(
            toUidAction(
              uid,
              changeVariableNameSucceeded({ type: 'constant', id: 'constant', data: { newName: 'constant' } })
            )
          );
      });
    });
    describe('when changeVariableName is dispatched with an unique name', () => {
      it('then the correct actions are dispatched', () => {
        const uid = 'uid';
        const textbox = textboxBuilder().withId('textbox').withDashboardUid(uid).withName('textbox').build();
        const constant = constantBuilder().withId('constant').withDashboardUid(uid).withName('constant').build();

        reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
          )
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })))
          )
          .whenActionIsDispatched(changeVariableName(toDashboardVariableIdentifier(constant), 'constant1'), true)
          .thenDispatchedActionsShouldEqual(
            toUidAction(
              uid,
              addVariable({
                type: 'constant',
                id: 'constant1',
                data: {
                  global: false,
                  index: 1,
                  model: {
                    ...constant,
                    name: 'constant1',
                    id: 'constant1',
                    global: false,
                    index: 1,
                    current: { selected: true, text: '', value: '' },
                    options: [{ selected: true, text: '', value: '' }],
                  } as ConstantVariableModel,
                },
              })
            ),
            toUidAction(
              uid,
              changeVariableNameSucceeded({ type: 'constant', id: 'constant1', data: { newName: 'constant1' } })
            ),
            toUidAction(uid, setIdInEditor({ id: 'constant1' })),
            toUidAction(uid, removeVariable({ type: 'constant', id: 'constant', data: { reIndex: false } }))
          );
      });
    });

    describe('when changeVariableName is dispatched with an unique name for a new variable', () => {
      it('then the correct actions are dispatched', () => {
        const uid = 'uid';
        const textbox = textboxBuilder().withId('textbox').withDashboardUid(uid).withName('textbox').build();
        const constant = constantBuilder().withId(NEW_VARIABLE_ID).withDashboardUid(uid).withName('constant').build();

        reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
          )
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })))
          )
          .whenActionIsDispatched(changeVariableName(toDashboardVariableIdentifier(constant), 'constant1'), true)
          .thenDispatchedActionsShouldEqual(
            toUidAction(
              uid,
              addVariable({
                type: 'constant',
                id: 'constant1',
                data: {
                  global: false,
                  index: 1,
                  model: {
                    ...constant,
                    name: 'constant1',
                    id: 'constant1',
                    global: false,
                    index: 1,
                    current: { selected: true, text: '', value: '' },
                    options: [{ selected: true, text: '', value: '' }],
                  } as ConstantVariableModel,
                },
              })
            ),
            toUidAction(
              uid,
              changeVariableNameSucceeded({ type: 'constant', id: 'constant1', data: { newName: 'constant1' } })
            ),
            toUidAction(uid, setIdInEditor({ id: 'constant1' })),
            toUidAction(uid, removeVariable({ type: 'constant', id: NEW_VARIABLE_ID, data: { reIndex: false } }))
          );
      });
    });

    describe('when changeVariableName is dispatched with __newName', () => {
      it('then the correct actions are dispatched', () => {
        const uid = 'uid';
        const textbox = textboxBuilder().withId('textbox').withDashboardUid(uid).withName('textbox').build();
        const constant = constantBuilder().withId('constant').withDashboardUid(uid).withName('constant').build();

        reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
          )
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })))
          )
          .whenActionIsDispatched(changeVariableName(toDashboardVariableIdentifier(constant), '__newName'), true)
          .thenDispatchedActionsShouldEqual(
            toUidAction(
              uid,
              changeVariableNameFailed({
                newName: '__newName',
                errorText: "Template names cannot begin with '__', that's reserved for Grafana's global variables",
              })
            )
          );
      });
    });

    describe('when changeVariableName is dispatched with illegal characters', () => {
      it('then the correct actions are dispatched', () => {
        const uid = 'uid';
        const textbox = textboxBuilder().withId('textbox').withDashboardUid(uid).withName('textbox').build();
        const constant = constantBuilder().withId('constant').withDashboardUid(uid).withName('constant').build();

        reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
          )
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })))
          )
          .whenActionIsDispatched(changeVariableName(toDashboardVariableIdentifier(constant), '#constant!'), true)
          .thenDispatchedActionsShouldEqual(
            toUidAction(
              uid,
              changeVariableNameFailed({
                newName: '#constant!',
                errorText: 'Only word and digit characters are allowed in variable names',
              })
            )
          );
      });
    });

    describe('when changeVariableName is dispatched with a name that is already used', () => {
      it('then the correct actions are dispatched', () => {
        const uid = 'uid';
        const textbox = textboxBuilder().withId('textbox').withDashboardUid(uid).withName('textbox').build();
        const constant = constantBuilder().withId('constant').withDashboardUid(uid).withName('constant').build();

        reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
          )
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })))
          )
          .whenActionIsDispatched(changeVariableName(toDashboardVariableIdentifier(constant), 'textbox'), true)
          .thenDispatchedActionsShouldEqual(
            toUidAction(
              uid,
              changeVariableNameFailed({
                newName: 'textbox',
                errorText: 'Variable with the same name already exists',
              })
            )
          );
      });
    });
  });

  describe('changeVariableMultiValue', () => {
    describe('when changeVariableMultiValue is dispatched for variable with multi enabled', () => {
      it('then correct actions are dispatched', () => {
        const uid = 'uid';
        const custom = customBuilder()
          .withId('custom')
          .withDashboardUid(uid)
          .withMulti(true)
          .withCurrent(['A'], ['A'])
          .build();

        reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
          )
          .whenActionIsDispatched(changeVariableMultiValue(toDashboardVariableIdentifier(custom), false), true)
          .thenDispatchedActionsShouldEqual(
            toUidAction(
              uid,
              changeVariableProp(
                toVariablePayload(custom, {
                  propName: 'multi',
                  propValue: false,
                })
              )
            ),
            toUidAction(
              uid,
              changeVariableProp(
                toVariablePayload(custom, {
                  propName: 'current',
                  propValue: {
                    value: 'A',
                    text: 'A',
                    selected: true,
                  },
                })
              )
            )
          );
      });
    });

    describe('when changeVariableMultiValue is dispatched for variable with multi disabled', () => {
      it('then correct actions are dispatched', () => {
        const uid = 'uid';
        const custom = customBuilder()
          .withId('custom')
          .withDashboardUid(uid)
          .withMulti(false)
          .withCurrent(['A'], ['A'])
          .build();

        reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(
            toUidAction(uid, addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
          )
          .whenActionIsDispatched(changeVariableMultiValue(toDashboardVariableIdentifier(custom), true), true)
          .thenDispatchedActionsShouldEqual(
            toUidAction(
              uid,
              changeVariableProp(
                toVariablePayload(custom, {
                  propName: 'multi',
                  propValue: true,
                })
              )
            ),
            toUidAction(
              uid,
              changeVariableProp(
                toVariablePayload(custom, {
                  propName: 'current',
                  propValue: {
                    value: ['A'],
                    text: ['A'],
                    selected: true,
                  },
                })
              )
            )
          );
      });
    });
  });

  describe('cleanUpVariables', () => {
    describe('when called', () => {
      it('then correct actions are dispatched', async () => {
        const uid = 'uid';
        reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(cleanUpVariables(uid))
          .thenDispatchedActionsShouldEqual(
            toUidAction(uid, cleanVariables()),
            toUidAction(uid, cleanEditorState()),
            toUidAction(uid, cleanPickerState()),
            toUidAction(uid, variablesClearTransaction())
          );
      });
    });
  });

  describe('cancelVariables', () => {
    const cancelAllInFlightRequestsMock = jest.fn();
    const backendSrvMock: any = {
      cancelAllInFlightRequests: cancelAllInFlightRequestsMock,
    };

    describe('when called', () => {
      it('then cancelAllInFlightRequests should be called and correct actions are dispatched', async () => {
        const uid = 'uid';
        reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(cancelVariables(uid, { getBackendSrv: () => backendSrvMock }))
          .thenDispatchedActionsShouldEqual(
            toUidAction(uid, cleanVariables()),
            toUidAction(uid, cleanEditorState()),
            toUidAction(uid, cleanPickerState()),
            toUidAction(uid, variablesClearTransaction())
          );

        expect(cancelAllInFlightRequestsMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('fixSelectedInconsistency', () => {
    describe('when called for a single value variable', () => {
      describe('and there is an inconsistency between current and selected in options', () => {
        it('then it should set the correct selected', () => {
          const variable = customBuilder().withId('custom').withCurrent('A').withOptions('A', 'B', 'C').build();
          variable.options[1].selected = true;

          expect(variable.options).toEqual([
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: true },
            { text: 'C', value: 'C', selected: false },
          ]);

          fixSelectedInconsistency(variable);

          expect(variable.options).toEqual([
            { text: 'A', value: 'A', selected: true },
            { text: 'B', value: 'B', selected: false },
            { text: 'C', value: 'C', selected: false },
          ]);
        });
      });

      describe('and there is no matching option in options', () => {
        it('then the first option should be selected', () => {
          const variable = customBuilder().withId('custom').withCurrent('A').withOptions('X', 'Y', 'Z').build();

          expect(variable.options).toEqual([
            { text: 'X', value: 'X', selected: false },
            { text: 'Y', value: 'Y', selected: false },
            { text: 'Z', value: 'Z', selected: false },
          ]);

          fixSelectedInconsistency(variable);

          expect(variable.options).toEqual([
            { text: 'X', value: 'X', selected: true },
            { text: 'Y', value: 'Y', selected: false },
            { text: 'Z', value: 'Z', selected: false },
          ]);
        });
      });
    });

    describe('when called for a multi value variable', () => {
      describe('and there is an inconsistency between current and selected in options', () => {
        it('then it should set the correct selected', () => {
          const variable = customBuilder().withId('custom').withCurrent(['A', 'C']).withOptions('A', 'B', 'C').build();
          variable.options[1].selected = true;

          expect(variable.options).toEqual([
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: true },
            { text: 'C', value: 'C', selected: false },
          ]);

          fixSelectedInconsistency(variable);

          expect(variable.options).toEqual([
            { text: 'A', value: 'A', selected: true },
            { text: 'B', value: 'B', selected: false },
            { text: 'C', value: 'C', selected: true },
          ]);
        });
      });

      describe('and there is no matching option in options', () => {
        it('then the first option should be selected', () => {
          const variable = customBuilder().withId('custom').withCurrent(['A', 'C']).withOptions('X', 'Y', 'Z').build();

          expect(variable.options).toEqual([
            { text: 'X', value: 'X', selected: false },
            { text: 'Y', value: 'Y', selected: false },
            { text: 'Z', value: 'Z', selected: false },
          ]);

          fixSelectedInconsistency(variable);

          expect(variable.options).toEqual([
            { text: 'X', value: 'X', selected: true },
            { text: 'Y', value: 'Y', selected: false },
            { text: 'Z', value: 'Z', selected: false },
          ]);
        });
      });
    });
  });

  describe('isVariableUrlValueDifferentFromCurrent', () => {
    describe('when called with a single valued variable', () => {
      describe('and values are equal', () => {
        it('then it should return false', () => {
          const variable = queryBuilder().withMulti(false).withCurrent('A', 'A').build();
          const urlValue = 'A';

          expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(false);
        });
      });

      describe('and values are different', () => {
        it('then it should return true', () => {
          const variable = queryBuilder().withMulti(false).withCurrent('A', 'A').build();
          const urlValue = 'B';

          expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(true);
        });
      });
    });

    describe('when called with a multi valued variable', () => {
      describe('and values are equal', () => {
        it('then it should return false', () => {
          const variable = queryBuilder().withMulti(true).withCurrent(['A'], ['A']).build();
          const urlValue = ['A'];

          expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(false);
        });

        describe('but urlValue is not an array', () => {
          it('then it should return false', () => {
            const variable = queryBuilder().withMulti(true).withCurrent(['A'], ['A']).build();
            const urlValue = 'A';

            expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(false);
          });
        });
      });

      describe('and values are different', () => {
        it('then it should return true', () => {
          const variable = queryBuilder().withMulti(true).withCurrent(['A'], ['A']).build();
          const urlValue = ['C'];

          expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(true);
        });

        describe('but urlValue is not an array', () => {
          it('then it should return true', () => {
            const variable = queryBuilder().withMulti(true).withCurrent(['A'], ['A']).build();
            const urlValue = 'C';

            expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(true);
          });
        });
      });
    });
  });
});
