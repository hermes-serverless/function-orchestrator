FROM docker:18.09

RUN apk add --no-cache yarn nodejs

ENV PORT 3000
EXPOSE ${PORT}

ENV NODE_ENV=development

WORKDIR /app/server

COPY package.json yarn.lock ./

RUN yarn

COPY . .

CMD [ "yarn", "nodemon" ]