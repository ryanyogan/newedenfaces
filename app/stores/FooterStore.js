'use strict';

import alt from '../alt';
import FooterActions from '../actions/FooterActions';

class FooterStore {
  constructor() {
    this.bindActions(FooterActions);
    this.characters = [];
  }

  onGetTopCharactersSuccess(data) {
    this.characters = data.slice(0, 5);
  }

  onGetTopCharactersFail(xhr) {
    toastr.error(xhr.responseJSON || xhr.responstText);
  }
}

export default alt.createStore(FooterStore);
