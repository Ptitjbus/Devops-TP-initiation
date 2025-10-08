const { createClient } = require('redis');
require('dotenv').config();

const client = createClient({
  username: 'default',
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
})
  .on('error', err => console.log('Redis Client Error', err))
  .on('connect', () => console.log('Redis Client Connected'));

async function getClient() {
  if (!client.isReady) {
    await client.connect();
  }
  return client;
}

async function storeMap(key, map) {
  const obj = Object.fromEntries(map);
  const json = JSON.stringify(obj);
  await client.set(key, json);
}

async function retrieveMap(key) {
  const json = await client.get(key);
  if (!json) return new Map();
  const obj = JSON.parse(json);
  return new Map(Object.entries(obj));
}

module.exports = {
  client,
  getClient,
  storeMap,
  retrieveMap
};
