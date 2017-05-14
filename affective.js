// pub nub stuff
var queue = []



// SDK Needs to create video and canvas nodes in the DOM in order to function
// Here we are adding those nodes a predefined div.
$(document).ready(function() {
  var divRoot = $("#affdex_elements")[0];
  var width = 640;
  var height = 480;
  var faceMode = affdex.FaceDetectorMode.LARGE_FACES;
  //Construct a CameraDetector and specify the image width / height and face detector mode.
  var detector = new affdex.CameraDetector(divRoot, width, height, faceMode);

  //Enable detection of all Expressions, Emotions and Emojis classifiers.
  detector.detectAllEmotions();
  detector.detectAllExpressions();
  detector.detectAllAppearance();

  //Add a callback to notify when the detector is initialized and ready for runing.
  detector.addEventListener("onInitializeSuccess", function() {
    log('#logs', "The detector reports initialized");
    //Display canvas instead of video feed because we want to draw the feature points on it
    $("#face_video_canvas").css("display", "block");
    $("#face_video").css("display", "none");
  });

  //Add a callback to notify when camera access is allowed
  detector.addEventListener("onWebcamConnectSuccess", function() {
    log('#logs', "Webcam access allowed");
  });

  //Add a callback to notify when camera access is denied
  detector.addEventListener("onWebcamConnectFailure", function() {
    log('#logs', "webcam denied");
  });

  //Add a callback to notify when detector is stopped
  detector.addEventListener("onStopSuccess", function() {
    log('#logs', "The detector reports stopped");
    $("#results").html("");
  });

  //Add a callback to receive the results from processing an image.
  //The faces object contains the list of the faces detected in an image.
  //Faces object contains probabilities for all the different expressions, emotions and appearance metrics
  detector.addEventListener("onImageResultsSuccess", function(faces, image, timestamp) {
    $('#results').html("");
    log('#results', "Timestamp: " + timestamp.toFixed(2));
    log('#results', "Number of faces found: " + faces.length);
    if (faces.length > 0) {
      log('#results', "Appearance: " + JSON.stringify(faces[0].appearance));
      log('#results', "Emotions: " + JSON.stringify(faces[0].emotions, function(key, val) {
        queue.push(faces[0].emotions)
          return val.toFixed ? Number(val.toFixed(0)) : val;
        }));
      log('#results', "Expressions: " + JSON.stringify(faces[0].expressions, function(key, val) {
          return val.toFixed ? Number(val.toFixed(0)) : val;
        }));
      log('#results', "Emoji: " + faces[0].emojis.dominantEmoji);
      drawFeaturePoints(image, faces[0].featurePoints);
    }
  }
);

  // Subscribe to pubnub
  var pubnub = new PubNub({
    publishKey : 'pub-c-24b2e5cd-04dd-4ccd-a99d-3fa20345d62e',
    subscribeKey : 'sub-c-ec1c11c0-3813-11e7-89f4-02ee2ddab7fe'
  });


   // setInterval(aggregateEmotionsAndPublish, 5000)


   function aggregateEmotions(){
     var valence = queue.reduce(function(acc, val) {
        return acc + val.valence;
      }, 0);
     var engagement = queue.reduce(function(acc, val) {
        return acc + val.engagement;
      }, 0);
     var length = queue.length
     var avgValence = valence / length
     var avgEngagement = engagement / length
     queue = []
     var emotions = {"valence": avgValence, "engagement": avgEngagement}
     return emotions
   }

  function publishMessage(emotions) {
    var publishConfig = {
      channel : "main",
      message : {
        "type": "EMOTIONS",
        "data": emotions
      }
    };
   pubnub.publish(publishConfig, function(status, response) {
    })
  }

  function aggregateEmotionsAndPublish(){
    var val = aggregateEmotions()
    publishMessage(val)
  }

  function testWindow(message) {
    var data = message.data
    var w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0');
    var html =
    `
    <iframe src="${data.image}" width="480" height="478" frameBorder="0" class="giphy-embed" allowFullScreen></iframe>

    <p> And don't forget to grab some  &#x1F366 at ${data.location.name}, just ${Math.floor(data.time_to_destination / 60)} minutes away! </p>
    `
    w.document.open().write(html)
  }

  var msg = { "type": "PROMPT", "data": { "image": "http://giphy.com/embed/12PA1eI8FBqEBa", "location": { "name": "Penguin Ice Cream", "location_longitude": "-73.99489694603201", "location_latitude": "40.71706120259381", "distance": "977" }, "time_to_destination": 910, "distance": 2.542 } }
  testWindow(msg)

  pubnub.addListener({
    message: function(message) {
      console.log("we're listning", message)
      message = message.message
      if (message.type !== "PROMPT") {
          return
      }
      console.log("popping")
      var w = window.open('http://www.google.com', '_blank', 'toolbar=0,location=0,menubar=0');

      var html =
      `
      <img src=${message.image}>
      `


      w.document.open().write(html)
    }
  })

  pubnub.subscribe({
    channels: ['main']
  });

  // Start detector.
  if (detector && !detector.isRunning) {
    $('#logs').html("");
    detector.start();
  }
  log('#logs', "Clicked the start button");
});



function log(node_name, msg) {
  $(node_name).append("<span>" + msg + "</span><br />")
}

//function executes when Start button is pushed.
function onStart() {
  if (detector && !detector.isRunning) {
    $("#logs").html("");
    detector.start();
  }
  log('#logs', "Clicked the start button");
}

//function executes when the Stop button is pushed.
function onStop() {
  log('#logs', "Clicked the stop button");
  if (detector && detector.isRunning) {
    detector.removeEventListener();
    detector.stop();
  }
};

//function executes when the Reset button is pushed.
function onReset() {
  log('#logs', "Clicked the reset button");
  if (detector && detector.isRunning) {
    detector.reset();

    $('#results').html("");
  }
};

//Draw the detected facial feature points on the image
function drawFeaturePoints(img, featurePoints) {
  var contxt = $('#face_video_canvas')[0].getContext('2d');

  var hRatio = contxt.canvas.width / img.width;
  var vRatio = contxt.canvas.height / img.height;
  var ratio = Math.min(hRatio, vRatio);

  contxt.strokeStyle = "#FFFFFF";
  for (var id in featurePoints) {
    contxt.beginPath();
    contxt.arc(featurePoints[id].x,
      featurePoints[id].y, 2, 0, 2 * Math.PI);
    contxt.stroke();

  }
}
