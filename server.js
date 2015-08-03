'use strict';

import async from 'async';
import request from 'request';
import express from 'express';
import path from 'path';
import logger from 'morgan';
import bodyParser from 'body-parser';
import xml2js from 'xml2js';

import swig from 'swig';
import React from 'react';
import Router from 'react-router';
import routes from './app/routes';
import config from './config';

import mongoose from 'mongoose';
import Character from './models/character';
import _ from 'underscore';

let app = express();

mongoose.connect(config.database);
mongoose.connection.on('error', () => {
  console.info('Error: Coud not connect to MongoDB.  Did you forget to run `mongod`?'.red);
});

app.set('port', process.env.PORT || 3000);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

/**
 * GET /api/characters/count
*/
app.get('/api/characters/count', (req, res, next) => {
  Character.count({}, (err, count) => {
    if (err) return next(err);
    res.send({ count: count });
  });
});

/**
 * GET /api/characters
*/
app.get('/api/characters', function(req, res, next) {
  var choices = ['Female', 'Male'];
  var randomGender = _.sample(choices);

  Character.find({ random: { $near: [Math.random(), 0] } })
    .where('voted', false)
    .where('gender', randomGender)
    .limit(2)
    .exec(function(err, characters) {
      if (err) return next(err);

      if (characters.length === 2) {
        return res.send(characters);
      }

      var oppositeGender = _.first(_.without(choices, randomGender));

      Character
        .find({ random: { $near: [Math.random(), 0] } })
        .where('voted', false)
        .where('gender', oppositeGender)
        .limit(2)
        .exec(function(err, characters) {
          if (err) return next(err);

          if (characters.length === 2) {
            return res.send(characters);
          }

          Character.update({}, { $set: { voted: false } }, { multi: true }, function(err) {
            if (err) return next(err);
            res.send([]);
          });
        });
    });
});

app.put('/api/characters', (req, res, next) => {
  let winner = req.body.winner;
  let loser = req.body.loser;

  if (!winner && !loser) {
    return res.status(400).send({ message: 'Voting requires two characters.' });
  }
  if (winner === loser) {
    return res.status(400).send({ message: 'Cannot vote for and against the same character.' });
  }

  async.parallel([
    function(callback) {
      Character.findOne({ characterId: winner }, function(err, winner) {
        callback(err, winner);
      });
    },
    function(callback) {
      Character.findOne({ characterId: loser }, function(err, loser) {
        callback(err, loser);
      });
    }
  ],
  function(err, results) {
    if (err) return next(err);

    let winner = results[0];
    let loser = results[1];

    if (!winner || !loser) {
      return res.status(404).send({ message: 'One of the characters no longer exists.' });
    }

    if (winner.voted || loser.voted) {
      return res.status(200).end();
    }

    async.parallel([
      function(callback) {
        winner.wins++;
        winner.voted = true;
        winner.random = [Math.random(), 0];
        winner.save(err => {
          callback(err);
        });
      },
      function(callback) {
        loser.losses++;
        loser.voted = true;
        loser.random = [Math.random(), 0];
        loser.save(err => {
          callback(err);
        });
      }
    ], (err) => {
      if (err) return next(err);
      res.status(200).end();
    });
  });
});

/**
 * POST /api/characters
 * Adds new character to the database
*/
app.post('/api/characters', (req, res, next) => {
  let gender = req.body.gender;
  let characterName = req.body.name;
  let characterIdLookupUrl = `https://api.eveonline.com/eve/CharacterID.xml.aspx?names=${characterName}`;

  let parser = new xml2js.Parser();

  async.waterfall([
    function(callback) {
      request.get(characterIdLookupUrl, (err, request, xml) => {
        if (err) return next(err);
        parser.parseString(xml, (err, parsedXml) => {
          if (err) return next(err);
          try {
            let characterId = parsedXml.eveapi.result[0].rowset[0].row[0].$.characterID;

            Character.findOne({ characterId: characterId }, (err, character) => {
              if (err) return next(err);
              if (character) {
                return res.status(409).send({ message: character.name + ' already exists!' });
              }

              callback(err, characterId);
            });
          } catch(e) {
            return res.status(400).send({ message: 'XML Parse Error' });
          }
        });
      });
    },
    function(characterId) {
      let characterInfoUrl = `https://api.eveonline.com/eve/CharacterInfo.xml.aspx?characterID=${characterId}`;

      request.get({ url: characterInfoUrl }, (err, request, xml) => {
        if (err) return next(err);
        parser.parseString(xml, (err, parsedXml) => {
          if (err) return next(err);
          try {
            let name = parsedXml.eveapi.result[0].characterName[0];
            let race = parsedXml.eveapi.result[0].race[0];
            let bloodline = parsedXml.eveapi.result[0].bloodline[0];

            let character = new Character({
              characterId: characterId,
              name: name,
              race: race,
              bloodline: bloodline,
              gender: gender,
              random: [Math.random(), 0]
            });

            character.save((err) => {
              if (err) return next(err);
              res.send({ message: `${characterName} has been added successfully!` });
            });
          } catch(e) {
            console.log(`HEY RYAN!!!: ${e}`);
            res.status(404).send({ message: `${characterName} is not registered` });
          }
        });
      });
    }
  ]);
});

/**
 * GET /api/characters/top
 * Return 100 highest ranked characters, filter by gender, race and bloodline
*/
app.get('/api/characters/top', (req, res, next) => {
  let params = req.query;
  let conditions = {};

  _.each(params, (value, key) => {
    conditions[key] = new RegExp('^' + value + '$', 'i');
  });

  Character
    .find(conditions)
    .sort('-wins')
    .limit(100)
    .exec((err, characters) => {
      if (err) return next(err);

      // Sort by winning percentage
      characters.sort((a, b) => {
        if (a.wins / (a.wins + a.losses) < b.wins / (b.wins + b.losses)) { return 1; }
        if (a.wins / (a.wins + a.losses) > b.wins / (b.wins + b.losses)) { return -1; }
        return 0;
      });

      res.send(characters);
    });
});

/**
 * GET /api/characters/search
*/
app.get('/api/characters/search', (req, res, next) => {
  let characterName = new RegExp(req.query.name, 'i');

  Character.find({ name: characterName }, (err, character) => {
    if (err) return next(err);

    if (!character) {
      return res.status(404).send({ message: 'Character not found.' });
    }

    res.send(character);
  });
});

/**
 * GET /api/characters/shame
*/
app.get('/api/characters/shame', (req, res, next) => {
  Character
    .find()
    .sort('-losses')
    .limit(100)
    .exec((err, characters) => {
      if (err) return next(err);
      res.send(characters);
    });
});

/**
 * POST /api/report
*/
app.post('/api/report', (req, res, next) => {
  let characterId = req.body.characterId;

  Character.findOne({ characterId: characterId }, (err, character) => {
    if (err) return next(err);

    if (!character) {
      return res.status(404).send({ message: 'Character not found.' });
    }

    character.reports++;

    if (character.reports > 4) {
      character.remove();
      return res.send({ message: `${character.name} has been deleted.` });
    }

    character.save(err => {
      if (err) return next(err);
      res.send({ message: `${character.name} has been reported.` });
    });
  });
});

/**
 * GET /api/stats
*/
app.get('/api/stats', (req, res, next) => {
  async.parallel([
    function(cb) {
      Character.cound({}, (err, count) => {
        cb(err, count);
      });
    },
    function(cb) {
      Character.count({ race: 'Amarr' }, (err, amarrCount) => {
        cb(err, amarrCount);
      });
    },
    function(cb) {
      Character.count({ race: 'Caldari' }, (err, caldariCount) => {
        cb(err, caldariCount);
      });
    },
    function(cb) {
      Character.count({ race: 'Gallente' }, (err, gallenteCount) => {
        cb(err, gallenteCount);
      });
    },
    function(cb) {
      Character.count({ race: 'Minmatar' }, (err, minmatarCount) => {
        cb(err, minmatarCount);
      });
    },
    function(cb) {
      Character.count({ gender: 'Male' }, (err, maleCount) => {
        cb(err, maleCount);
      });
    },
    function(cb) {
      Character.count({ gender: 'Female' }, (err, femaleCount) => {
        cb(err, femaleCount);
      });
    },
    function(cb) {
      Character.aggregate({ $group: { _id: null, total: { $sum: '$wins' } } }, (err, totalVotes) => {
        let total = totalVotes.length ? totalVotes[0].total : 0;
        cb(err, total);
      });
    },
    function(cb) {
      Character
        .find()
        .sort('-wins')
        .limit(100)
        .select('race')
        .exec((err, characters) => {
          if (err) return next(err);

          let raceCount = _.countBy(characters, (character => character.race));
          let max = _.max(raceCount, (race => race));
          let inverted = _.invert(raceCount);
          let topRace = inverted[max];
          let topCount = raceCount[topRace];

          cb(err, { race: topRace, count: topCount });
        });
    },
    function(cb) {
      Character
        .find()
        .sort('-wins')
        .limit(100)
        .select('bloodline')
        .exec((err, characters) => {
          if (err) return next(err);

          let bloodlineCount = _.countBy(characters, (character => character.bloodline));
          let max = _max(bloodlineCount, (bloodline => bloodline));
          let inverted = _.invert(bloodlineCount);
          let topBloodline = inverted(max);
          let topCount = bloodlineCount[topBloodline];

          cb(err, { bloodline: topBloodline, count: topCount });
        });
    }
  ],
  function(err, results) {
    if (err) return next(err);

    res.send({
      totalCount: results[0],
      amarrCount: results[1],
      caldariCount: results[2],
      gallenteCount: results[3],
      minmaterCount: results[4],
      maleCount: results[5],
      femaleCount: results[6],
      totaleVotes: results[7],
      leadingRace: results[8],
      leadingBloodline: results[0]
    });
  });
});

/**
 * GET /api/characters/:id
*/
app.get('/api/characters/:id', (req, res, next) => {
  let id = req.params.id;

  Character.findOne({ characterId: id }, (err, character) => {
    if (err) return next(err);

    if (!character) {
      return res.status(404).send({ message: 'Character not found.' });
    }

    res.send(character);
  });
});

app.use((req, res) => {
  Router.run(routes, req.path, (Handler) => {
    let html = React.renderToString(React.createElement(Handler));
    let page = swig.renderFile('views/index.html', { html: html });
    res.send(page);
  });
});

app.use((err, req, res, next) => {
  console.log(err.stack.red);
  res.stats(err.status || 500);
  res.send({ message: err.message });
});

/**
 * Socket.io config
*/
let server = require('http').createServer(app);
import socket from 'socket.io'
let io = (socket)(server);
let onlineUsers = 0;

io.sockets.on('connection', (socket) => {
  onlineUsers++;

  io.sockets.emit('onlineUsers', { onlineUsers: onlineUsers });

  socket.on('disconnect', () => {
    onlineUsers--;
    io.sockets.emit('onlineUsers', { onlineUsers: onlineUsers });
  });
});


server.listen(app.get('port'), () => {
  console.log(`Express server is listening on port ${app.get('port')}`);
});
