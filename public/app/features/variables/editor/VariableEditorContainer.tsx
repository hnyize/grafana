import React, { MouseEvent, PureComponent } from 'react';
import { bindActionCreators } from 'redux';
import { Icon, LinkButton } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { DashboardVariableIdentifier } from '../state/types';
import { StoreState, ThunkDispatch } from '../../../types';
import { VariableEditorEditor } from './VariableEditorEditor';
import { connect, ConnectedProps } from 'react-redux';
import { getDashboardEditorVariables, getDashboardVariablesState } from '../state/selectors';
import { switchToEditMode, switchToListMode, switchToNewMode } from './actions';
import { changeVariableOrder, duplicateVariable, removeVariable } from '../state/sharedReducer';
import { VariableEditorList } from './VariableEditorList';
import { VariablesUnknownTable } from '../inspect/VariablesUnknownTable';
import { VariablesDependenciesButton } from '../inspect/VariablesDependenciesButton';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { toUidAction } from '../state/dashboardVariablesReducer';
import { toDashboardVariableIdentifier, toVariablePayload } from '../utils';

const mapStateToProps = (state: StoreState, ownProps: OwnProps) => {
  const { uid } = ownProps.dashboard;
  const templatingState = getDashboardVariablesState(uid, state);
  return {
    variables: getDashboardEditorVariables(uid, state),
    idInEditor: templatingState.editor.id,
    usagesNetwork: templatingState.inspect.usagesNetwork,
    usages: templatingState.inspect.usages,
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch) => {
  return {
    ...bindActionCreators({ switchToNewMode, switchToEditMode, switchToListMode }, dispatch),
    changeVariableOrder: (identifier: DashboardVariableIdentifier, fromIndex: number, toIndex: number) =>
      dispatch(
        toUidAction(identifier.dashboardUid, changeVariableOrder(toVariablePayload(identifier, { fromIndex, toIndex })))
      ),
    duplicateVariable: (identifier: DashboardVariableIdentifier) =>
      dispatch(
        toUidAction(
          identifier.dashboardUid,
          duplicateVariable(toVariablePayload(identifier, { newId: (undefined as unknown) as string }))
        )
      ),
    removeVariable: (identifier: DashboardVariableIdentifier) => {
      dispatch(toUidAction(identifier.dashboardUid, removeVariable(toVariablePayload(identifier, { reIndex: true }))));
    },
  };
};

interface OwnProps {
  dashboard: DashboardModel;
}

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & ConnectedProps<typeof connector>;

class VariableEditorContainerUnconnected extends PureComponent<Props> {
  componentDidMount(): void {
    this.props.switchToListMode(this.props.dashboard.uid);
  }

  onChangeToListMode = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.switchToListMode(this.props.dashboard.uid);
  };

  onEditVariable = (identifier: DashboardVariableIdentifier) => {
    this.props.switchToEditMode(identifier);
  };

  onNewVariable = () => {
    this.props.switchToNewMode(this.props.dashboard.uid);
  };

  onChangeVariableOrder = (identifier: DashboardVariableIdentifier, fromIndex: number, toIndex: number) => {
    this.props.changeVariableOrder(identifier, fromIndex, toIndex);
  };

  onDuplicateVariable = (identifier: DashboardVariableIdentifier) => {
    this.props.duplicateVariable(identifier);
  };

  onRemoveVariable = (identifier: DashboardVariableIdentifier) => {
    this.props.removeVariable(identifier);
  };

  render() {
    const variableToEdit = this.props.variables.find((s) => s.id === this.props.idInEditor) ?? null;

    return (
      <div>
        <div className="page-action-bar">
          <h3 className="dashboard-settings__header">
            <a
              onClick={this.onChangeToListMode}
              aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.headerLink}
            >
              Variables
            </a>
            {this.props.idInEditor && (
              <span>
                <Icon name="angle-right" />
                Edit
              </span>
            )}
          </h3>

          <div className="page-action-bar__spacer" />
          {this.props.variables.length > 0 && variableToEdit === null && (
            <>
              <VariablesDependenciesButton variables={this.props.variables} />
              <LinkButton
                type="button"
                onClick={this.onNewVariable}
                aria-label={selectors.pages.Dashboard.Settings.Variables.List.newButton}
              >
                New
              </LinkButton>
            </>
          )}
        </div>

        {!variableToEdit && (
          <VariableEditorList
            variables={this.props.variables}
            onAdd={this.onNewVariable}
            onEdit={this.onEditVariable}
            onChangeOrder={this.onChangeVariableOrder}
            onDuplicate={this.onDuplicateVariable}
            onDelete={this.onRemoveVariable}
            usages={this.props.usages}
            usagesNetwork={this.props.usagesNetwork}
          />
        )}
        {!variableToEdit && this.props.variables.length > 0 && (
          <VariablesUnknownTable variables={this.props.variables} dashboard={this.props.dashboard} />
        )}
        {variableToEdit && <VariableEditorEditor identifier={toDashboardVariableIdentifier(variableToEdit)} />}
      </div>
    );
  }
}

export const VariableEditorContainer = connector(VariableEditorContainerUnconnected);
