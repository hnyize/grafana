import { AnyAction, createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  addVariable,
  changeVariableOrder,
  changeVariableProp,
  changeVariableType,
  duplicateVariable,
  removeVariable,
} from './sharedReducer';
import { TransactionStatus } from '../types';

export interface TransactionState {
  uid: string | undefined | null;
  status: TransactionStatus;
  isDirty: boolean;
}

export const initialTransactionState: TransactionState = {
  uid: null,
  status: TransactionStatus.NotStarted,
  isDirty: false,
};

const transactionSlice = createSlice({
  name: 'templating/transaction',
  initialState: initialTransactionState,
  reducers: {
    variablesInitTransaction: (state, action: PayloadAction<{ uid: string | undefined | null }>) => {
      state.uid = action.payload.uid;
      state.status = TransactionStatus.Fetching;
    },
    variablesCompleteTransaction: (state, action: PayloadAction<{ uid: string | undefined | null }>) => {
      if (state.uid !== action.payload.uid) {
        // this might be an action from a cancelled batch
        return;
      }

      state.status = TransactionStatus.Completed;
    },
    variablesClearTransaction: (state, action: PayloadAction<undefined>) => {
      state.uid = null;
      state.status = TransactionStatus.NotStarted;
      state.isDirty = false;
    },
  },
  extraReducers: (builder) =>
    builder.addMatcher(actionAffectsDirtyState, (state, action) => {
      if (state.status === TransactionStatus.Completed) {
        state.isDirty = true;
      }
    }),
});

function actionAffectsDirtyState(action: AnyAction): boolean {
  if (removeVariable.match(action)) {
    return true;
  }
  if (addVariable.match(action)) {
    return true;
  }
  if (changeVariableProp.match(action)) {
    return true;
  }
  if (changeVariableOrder.match(action)) {
    return true;
  }
  if (duplicateVariable.match(action)) {
    return true;
  }
  if (changeVariableType.match(action)) {
    return true;
  }

  return false;
}

export const {
  variablesInitTransaction,
  variablesClearTransaction,
  variablesCompleteTransaction,
} = transactionSlice.actions;

export const transactionReducer = transactionSlice.reducer;
