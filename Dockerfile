# ================ COMMON ================

FROM docker:18.09 as common 

RUN apk add --no-cache yarn nodejs

ENV PORT 3000

EXPOSE ${PORT}

RUN mkdir -p /app/server && \
  mkdir -p /app/results 

WORKDIR /app/server

COPY package.json yarn.lock ./

# ================ DEVELOPMENT ================

FROM common as development

ENV NODE_ENV=development

RUN yarn && yarn cache clean

COPY . .

RUN yarn tsc

CMD [ "yarn", "nodemon" ]


# ================ PRODUCTION ================

FROM common as production 

ENV NODE_ENV=production

RUN yarn --production && \
  yarn autoclean --init && \
  echo *.ts >> .yarnclean && \
  echo *.ts.map >> .yarnclean && \
  echo *.spec.* >> .yarnclean && \
  yarn autoclean --force && \
  yarn cache clean

COPY --from=development /app/server/build .

CMD [ "yarn", "start:prod" ]