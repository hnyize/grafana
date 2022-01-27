import { debounce, trim } from 'lodash';
import { StoreState, ThunkDispatch, ThunkResult } from 'app/types';
import { VariableOption, VariableWithMultiSupport, VariableWithOptions } from '../../types';
import { variableAdapters } from '../../adapters';
import { getDashboardVariable, getDashboardVariablesState } from '../../state/selectors';
import { NavigationKey } from '../types';
import {
  hideOptions,
  moveOptionsHighlight,
  OptionsPickerState,
  showOptions,
  toggleOption,
  updateOptionsAndFilter,
  updateOptionsFromSearch,
  updateSearchQuery,
} from './reducer';
import { changeVariableProp, setCurrentVariableValue } from '../../state/sharedReducer';
import { DashboardVariableIdentifier } from '../../state/types';
import { containsSearchFilter, getCurrentText, toVariablePayload } from '../../utils';
import { toUidAction } from '../../state/dashboardVariablesReducer';

export const navigateOptions = (uid: string, key: NavigationKey, clearOthers: boolean): ThunkResult<void> => {
  return async (dispatch, getState) => {
    if (key === NavigationKey.cancel) {
      return await dispatch(commitChangesToVariable(uid));
    }

    if (key === NavigationKey.select) {
      return dispatch(toggleOptionByHighlight(uid, clearOthers));
    }

    if (key === NavigationKey.selectAndClose) {
      dispatch(toggleOptionByHighlight(uid, clearOthers, true));
      return await dispatch(commitChangesToVariable(uid));
    }

    if (key === NavigationKey.moveDown) {
      return dispatch(toUidAction(uid, moveOptionsHighlight(1)));
    }

    if (key === NavigationKey.moveUp) {
      return dispatch(toUidAction(uid, moveOptionsHighlight(-1)));
    }

    return undefined;
  };
};

export const filterOrSearchOptions = (
  passedIdentifier: DashboardVariableIdentifier,
  searchQuery = ''
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { dashboardUid: uid } = passedIdentifier;
    const { id, queryValue } = getDashboardVariablesState(uid, getState()).optionsPicker;
    const identifier: DashboardVariableIdentifier = { id, dashboardUid: uid, type: 'query' };
    const { query, options } = getDashboardVariable<VariableWithOptions>(identifier, getState());
    dispatch(toUidAction(uid, updateSearchQuery(searchQuery)));

    if (trim(queryValue) === trim(searchQuery)) {
      return;
    }

    if (containsSearchFilter(query)) {
      return searchForOptionsWithDebounce(dispatch, getState, searchQuery, uid);
    }
    return dispatch(toUidAction(uid, updateOptionsAndFilter(options)));
  };
};

const setVariable = async (updated: VariableWithMultiSupport) => {
  const adapter = variableAdapters.get(updated.type);
  await adapter.setValue(updated, updated.current, true);
  return;
};

export const commitChangesToVariable = (uid: string, callback?: (updated: any) => void): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const picker = getDashboardVariablesState(uid, getState()).optionsPicker;
    const identifier: DashboardVariableIdentifier = { id: picker.id, dashboardUid: uid, type: 'query' };
    const existing = getDashboardVariable<VariableWithMultiSupport>(identifier, getState());
    const currentPayload = { option: mapToCurrent(picker) };
    const searchQueryPayload = { propName: 'queryValue', propValue: picker.queryValue };

    dispatch(toUidAction(uid, setCurrentVariableValue(toVariablePayload(existing, currentPayload))));
    dispatch(toUidAction(uid, changeVariableProp(toVariablePayload(existing, searchQueryPayload))));
    const updated = getDashboardVariable<VariableWithMultiSupport>(identifier, getState());
    dispatch(toUidAction(uid, hideOptions()));

    if (getCurrentText(existing) === getCurrentText(updated)) {
      return;
    }

    if (callback) {
      return callback(updated);
    }

    return await setVariable(updated);
  };
};

export const openOptions = (
  identifier: DashboardVariableIdentifier,
  callback?: (updated: any) => void
): ThunkResult<void> => async (dispatch, getState) => {
  const { id, dashboardUid: uid } = identifier;
  const picker = getDashboardVariablesState(uid, getState()).optionsPicker;

  if (picker.id && picker.id !== id) {
    await dispatch(commitChangesToVariable(uid, callback));
  }

  const variable = getDashboardVariable<VariableWithMultiSupport>(identifier, getState());
  dispatch(toUidAction(uid, showOptions(variable)));
};

export const toggleOptionByHighlight = (uid: string, clearOthers: boolean, forceSelect = false): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { highlightIndex, options } = getDashboardVariablesState(uid, getState()).optionsPicker;
    const option = options[highlightIndex];
    dispatch(toUidAction(uid, toggleOption({ option, forceSelect, clearOthers })));
  };
};

const searchForOptions = async (
  dispatch: ThunkDispatch,
  getState: () => StoreState,
  searchQuery: string,
  uid: string
) => {
  try {
    const { id } = getDashboardVariablesState(uid, getState()).optionsPicker;
    const identifier: DashboardVariableIdentifier = { id, dashboardUid: uid, type: 'query' };
    const existing = getDashboardVariable<VariableWithOptions>(identifier, getState());

    const adapter = variableAdapters.get(existing.type);
    await adapter.updateOptions(existing, searchQuery);

    const updated = getDashboardVariable<VariableWithOptions>(identifier, getState());
    dispatch(toUidAction(uid, updateOptionsFromSearch(updated.options)));
  } catch (error) {
    console.error(error);
  }
};

const searchForOptionsWithDebounce = debounce(searchForOptions, 500);

export function mapToCurrent(picker: OptionsPickerState): VariableOption | undefined {
  const { options, selectedValues, queryValue: searchQuery, multi } = picker;

  if (options.length === 0 && searchQuery && searchQuery.length > 0) {
    return { text: searchQuery, value: searchQuery, selected: false };
  }

  if (!multi) {
    return selectedValues.find((o) => o.selected);
  }

  const texts: string[] = [];
  const values: string[] = [];

  for (const option of selectedValues) {
    if (!option.selected) {
      continue;
    }

    texts.push(option.text.toString());
    values.push(option.value.toString());
  }

  return {
    value: values,
    text: texts,
    selected: true,
  };
}
