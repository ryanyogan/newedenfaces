'use strict';

import alt from '../alt';

class FooterActions {
  constructor() {
    this.generateActions(
      'getTopCharactersSuccess',
      'getTopCharactersFail'
    );
  }

  getTopCharacters() {
    $.ajax({ url: '/api/characters/top' })
      .done((data) => {
        this.actions.getTopCharactersSuccess(data);
      })
      .fail((xhr) => {
        this.actions.getTopCharactersFail(xhr);
      });
  }
}

export default alt.createActions(FooterActions);
