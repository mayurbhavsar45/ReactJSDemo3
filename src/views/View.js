// @flow
import React, { Component } from 'react';
import { Background } from 'aq-miniapp-components-ui';
import View1 from './js/View1';
import View2 from './js/View2';
import View3 from './js/View3';
import bg from '../assets/gyro-cube-bg1.jpg';

import type { Output } from './Types';
type Props = {}

export default class View extends Component {
  state: {
    currentPage: number,
    output: Output
  }

  constructor(props: Props) {
    super(props);

    this.state = {
      currentPage: 1,
      output: {}
    }
  }

  _onView1Click() {
      this.setState({currentPage: 2});
  }

  _onView2Click(output: Output) {
    this.setState({currentPage: 3, output: output});
  }

  _onView3Click() {
    this.setState({currentPage: 1});
  }

  render() {
    let render = null;

    switch (this.state.currentPage) {
      case 1:
        render = <View1 onClick={this._onView1Click.bind(this)}/>
        break;
      case 2:
        render = <View2 onClick={this._onView2Click.bind(this)}/>
        break;
      case 3:
        render = <View3 output={this.state.output} onClick={this._onView3Click.bind(this)}/>
        break;
      default:
        break;
    }

    return (
      <div className='container'>
        <Background
          image={bg}
        />
        {render}
      </div>
    );
  }
}
