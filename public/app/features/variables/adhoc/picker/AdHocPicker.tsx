import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { AdHocVariableFilter, AdHocVariableModel } from 'app/features/variables/types';
import { VariablePickerProps } from '../../pickers/types';
import { addFilter, changeFilter, removeFilter } from '../actions';
import { AdHocFilter } from './AdHocFilter';
import { toDashboardVariableIdentifier } from '../../utils';

const mapDispatchToProps = {
  addFilter,
  removeFilter,
  changeFilter,
};

const connector = connect(null, mapDispatchToProps);

interface OwnProps extends VariablePickerProps<AdHocVariableModel> {}

type Props = OwnProps & ConnectedProps<typeof connector>;

/**
 * Thin wrapper over AdHocFilter to add redux actions and change the props so it can be used for ad hoc variable
 * control.
 */
export class AdHocPickerUnconnected extends PureComponent<Props> {
  addFilter = (filter: AdHocVariableFilter) => {
    this.props.addFilter(toDashboardVariableIdentifier(this.props.variable), filter);
  };

  removeFilter = (index: number) => {
    this.props.removeFilter(toDashboardVariableIdentifier(this.props.variable), index);
  };

  changeFilter = (index: number, filter: AdHocVariableFilter) => {
    this.props.changeFilter(toDashboardVariableIdentifier(this.props.variable), {
      index,
      filter,
    });
  };

  render() {
    const { filters, datasource } = this.props.variable;

    return (
      <AdHocFilter
        datasource={datasource}
        filters={filters}
        addFilter={this.addFilter}
        removeFilter={this.removeFilter}
        changeFilter={this.changeFilter}
      />
    );
  }
}

export const AdHocPicker = connector(AdHocPickerUnconnected);
AdHocPicker.displayName = 'AdHocPicker';
