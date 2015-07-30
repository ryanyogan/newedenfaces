'use strict';

import React from 'react';
import {RouteHandler} from 'react-router';

import Navbar from './Navbar';
import Footer from './Footer';

const {
  Component,
} = React;

class App extends Component {
  render() {
    return (
      <div>
        <Navbar />
        <RouteHandler />
        <Footer />
      </div>
    );
  }
}

export default App;
