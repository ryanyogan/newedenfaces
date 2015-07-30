'use strict';

import express from 'express';
import path from 'path';
import logger from 'morgan';
import bodyParser from 'body-parser';

import swig from 'swig';
import React from 'react';
import Router from 'react-router';
import routes from './app/routes';
import config from './config';

import mongoose from 'mongoose';
import Character from './models/character';

let app = express();

mongoose.connect(config.database);
mongoose.connection.on('error', () => {
  console.info('Error: Coud not connect to MongoDB.  Did you forget to run `mongod`?');
});

app.set('port', process.env.PORT || 3000);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  Router.run(routes, req.path, (Handler) => {
    let html = React.renderToString(React.createElement(Handler));
    let page = swig.renderFile('views/index.html', { html: html });
    res.send(page);
  });
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
