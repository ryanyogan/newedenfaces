'use strict';

import express from 'express';
import path from 'path';
import logger from 'morgan';
import bodyParser from 'body-parser';

let app = express();

app.set('port', process.env.PORT || 3000);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(app.get('port'), () => {
  console.log(`Express server is listening on port ${app.get('port')}`);
});
