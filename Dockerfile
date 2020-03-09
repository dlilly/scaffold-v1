FROM node:latest

ENV CT_VAULT_CONFIG=/usr/src/app/config/vault/vault_config.json
ENV GOOGLE_APPLICATION_CREDENTIALS=/usr/src/app/config/vault/google_creds.json

WORKDIR /usr/src/app
COPY package.json .
RUN npm install    
COPY . .

CMD [ "npm", "start" ]