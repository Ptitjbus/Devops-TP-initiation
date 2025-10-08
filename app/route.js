const formValidator = require('./form_validator');
const photoModel = require('./photo_model');
const { PubSub } = require('@google-cloud/pubsub');
require('dotenv').config();
const ZipStream = require('zip-stream');
const request = require('request');
const { Storage } = require('@google-cloud/storage');
const moment = require('moment');
const rateLimiter = require('./rate_limiter');

const projectId = process.env.PROJECT_ID;
const topicNameOrId = process.env.TOPIC_NAME_OR_ID;

let storage = new Storage();

function route(app) {
  app.get('/zip', async (req, res) => {
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    if (!rateLimiter.checkRateLimit(ip)) {
      return res.status(429).send('Too Many Requests');
    }

    const tags = req.query.tags || '';
    const tagmode = req.query.tagmode || '';

    photoModel.getFlickrPhotos(tags, tagmode).then(async photos => {
      var zip = new ZipStream();

      let queue = [];
      photos.forEach(photo => {
        const title = photo.media.b.split('/').pop();
        queue.push({ name: title, url: photo.media.b });
      });

      function addNextFile() {
        var elem = queue.shift();
        var readstream = request(elem.url);
        zip.entry(readstream, { name: elem.name }, err => {
          if (err) throw err;
          if (queue.length > 0) addNextFile();
          else zip.finalize();
        });
      }

      addNextFile();

      const filename = 'test.zip';

      const file = await storage
        .bucket(process.env.BUCKET_NAME)
        .file('public/users/' + filename);
      const writestream = file.createWriteStream({
        metadata: {
          contentType: 'application/zip',
          cacheControl: 'private'
        },
        resumable: false
      });
      zip.pipe(writestream);
      await new Promise((resolve, reject) => {
        writestream.on('error', err => {
          console.log('error', err);
          reject(err);
        });

        writestream.on('finish', () => {
          console.log('finish');
          resolve('Ok');
        });
      });
      return res.send('Zip file created');
    });
  });

  app.get('/send', async (req, res) => {
    const message = req.query.message;

    const pubsub = new PubSub({ projectId });

    const topic = await pubsub.topic(topicNameOrId);

    await topic.publishMessage({ data: Buffer.from(message) });

    return res.send('Message sent');
  });

  app.get('/', async (req, res) => {
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    const isRateLimited = await rateLimiter.checkRateLimit(ip);
    if (!isRateLimited) {
      return res.status(429).send('Too Many Requests');
    }

    const tags = req.query.tags;
    const tagmode = req.query.tagmode;

    const ejsLocalVariables = {
      tagsParameter: tags || '',
      tagmodeParameter: tagmode || '',
      photos: [],
      searchResults: false,
      signedUrls: [],
      invalidParameters: false
    };

    // if no input params are passed in then render the view with out querying the api
    if (!tags && !tagmode) {
      return res.render('index', ejsLocalVariables);
    }

    const options = {
      action: 'read',
      expires:
        moment()
          .add(2, 'days')
          .unix() * 1000
    };

    const signedUrls = await storage
      .bucket(process.env.BUCKET_NAME)
      .file('public/users/' + 'test.zip')
      .getSignedUrl(options);

    // validate query parameters
    if (!formValidator.hasValidFlickrAPIParams(tags, tagmode)) {
      ejsLocalVariables.invalidParameters = true;
      return res.render('index', ejsLocalVariables);
    }

    // get photos from flickr public feed api
    return photoModel
      .getFlickrPhotos(tags, tagmode)
      .then(photos => {
        ejsLocalVariables.photos = photos;
        ejsLocalVariables.searchResults = true;
        ejsLocalVariables.signedUrls = signedUrls;
        return res.render('index', ejsLocalVariables);
      })
      .catch(error => {
        console.log('aspdfonaposd', error);
        return res.status(500).send({ error });
      });
  });
}

module.exports = route;
