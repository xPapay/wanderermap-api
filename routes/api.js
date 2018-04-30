var express = require('express');
var router = express.Router();
require('dotenv').config({ path: '.env' });
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;

MongoClient.connect(process.env.DB_CONNECTION)
.then((client) => {
  db = client.db();
})
.catch((err) => {
  console.error('Unable to connect to database');
  process.exit(1);
});

async function fetchPlaces(southWest, northEast) {
  // TODO: move logic into models
  let showers = await db.collection('places').find({
    $and: [ 
      { 
        lat: { 
          $gte: parseFloat(southWest[0]) 
        } 
      },
      { 
        lat: { 
          $lte: parseFloat(northEast[0])
        } 
      }, 
      { 
        lng: { 
          $gte: parseFloat(southWest[1])
        } 
      },
      { 
        lng: { 
          $lte: parseFloat(northEast[1])
        } 
      } 
    ]
  }).toArray();

  return showers;
}

router.use(function (req, res, next) {
  res.set({
    'Access-control-allow-credentials': true,
    'Access-control-allow-origin': '*'
  });
  next();
});

router.get('/places', async function(req, res, next) {
  if (! req.query.southWest || ! req.query.northEast) {
    res.status(422).json({
      error: 'South-west and north-east boundaries are required parameters'
    });
    return;
  }

  let { southWest, northEast } = req.query;
  southWest = southWest.split(',');
  northEast = northEast.split(',');
  let places = await fetchPlaces(southWest, northEast);
  return res.json(places);
});

router.post('/place/:id/amenity/change_status', async function(req, res, next) {
  if (! req.params.id) {
    res.status(422).json({
      error: 'ID of the place is required'
    });
    return;
  }

  if (! req.query.amenity_name) {
    res.status(422).json({
      error: 'Amenity name is requried parameter'
    });
    return;
  }

  if ( ! req.query.action) {
    res.status(422).json({
      error: 'Amenity action is requried parameter'
    });
    return;
  }

  const actions = {
    validate: 'available',
    invalidate: 'not available'
  }

  const actionKeys = Object.keys(actions);

  if (! actionKeys.includes(req.query.action)) {
    res.status(422).json({
      error: `Amenity action can be only "${actionKeys.join(', ')}."`
    });

    return;
  }

  await db.collection('places').updateOne({
    _id: new ObjectId(req.params.id),
    'amenities.name': req.query.amenity_name
  }, {
    $set: {
      'amenities.$.status': actions[req.query.action]
    }
  });

  return res.json({name: req.query.amenity_name, status: actions[req.query.action]});
});

router.get('/place/:id', async function(req, res, next) {
  if (! req.params.id) {
    res.status(422).json({
      error: 'ID of the place is required'
    });
    return;
  }
  let poi = await db.collection('places').findOne({_id: new ObjectId(req.params.id)});
  res.json(poi);
})

module.exports = router;
