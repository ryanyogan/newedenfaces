'use strict';

import React from 'react';
import {RouteHandler} from 'react-router';

const {
  Component,
} = React;

class App extends Component {
  render() {
    return (
      <div>
        <RouteHandler />
      </div>
    );
  }
}

export default App;
