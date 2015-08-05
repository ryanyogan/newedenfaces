FROM node:latest

RUN mkdir /src

RUN npm install nodemon -g
RUN npm install bower -g
RUN npm install gulp -g

WORKDIR /src
ADD . /src

RUN echo '{ "allow_root": true }' > /root/.bowerrc
RUN npm install
RUN bower install && gulp build

EXPOSE 3000

CMD npm start
