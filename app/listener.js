const { PubSub } = require('@google-cloud/pubsub');
require('dotenv').config();

const pubSubClient = new PubSub();
const subscription = pubSubClient.subscription(process.env.SUBSCRIPTION_NAME);

// Create an event handler to handle messages
const messageHandler = message => {
  res.send(`Message (${message.id}) : ${message.data}`);
};

// Listen for new messages until timeout is hit
subscription.on('message', messageHandler);
