const { getClient } = require('./database');

const recuperation_speed = 1;
const bucket_size = 15;
const request_cost = 3;

const tokenBuckets = new Map();

async function checkRateLimit(ip) {
  const now = Date.now() / 1000;
  const bucketKey = `rate_limit:${ip}`;

  const client = await getClient();
  let dataString = await client.get(bucketKey);
  let data;

  if (!dataString) {
    data = {
      lastTimestamp: now,
      tokens: bucket_size - request_cost
    };
    await client.set(bucketKey, JSON.stringify(data));
    return true;
  } else {
    data = JSON.parse(dataString);
  }

  const delta = now - data.lastTimestamp;
  let tokensToAdd = delta * recuperation_speed;
  let currentTokens = Math.min(bucket_size, data.tokens + tokensToAdd);

  if (currentTokens < request_cost) {
    return false;
  }

  currentTokens -= request_cost;
  const updatedData = {
    lastTimestamp: now,
    tokens: currentTokens
  };
  await client.set(bucketKey, JSON.stringify(updatedData));
  return true;
}

module.exports = {
  checkRateLimit
};
