String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

addEventListener("message", function(evt) {

    if (evt.data && evt.data.message) {
        var message = evt.data.message;

        switch(message) {
          case "ctor":
              ctor(evt.data.url);
              break;
          case "process":
              processImg(evt.data.img, evt.data.time);
              break;
          case "start":
              start(evt.data);
              break;
          case "reset":
              reset();
              break;
          case "stop":
              stop();
              break;
        }
    }
});

var Module = null;
var detector = null;
var imgPtr = null;
var frame = null;
var staticMode = false;

var emotions = null;
var expressions = null;
var appearance = null;
var detectEmojis = false;
var emojis = [ "relaxed", "smiley", "laughing", "kissing", "disappointed",
               "rage", "smirk", "wink", "stuckOutTongueWinkingEye", "stuckOutTongue",
               "flushed", "scream", "dominantEmoji"];

function ctor(url) {
  try {
    Module = Module || {
      "memoryInitializerPrefixURL": url,
      "filePackagePrefixURL": url
    };
    importScripts(url + "affdex-native-bindings.asm.js");
    importScripts(url + "affdex-native-bindings.js");

    Module.onLoaded = function() {
        postMessage({ "message": "ready", "status": true });
    };
  }
  catch(err) {
    postMessage({ "message": "ready", "status": false, "detail": err });
  }


}


function reset() {
  try {
    if (detector) {
      detector.reset();
      postMessage({"message":"reset", "status": true});
    }
  }
  catch(err) {
    postMessage({"message": "reset", "status": false, "detail": err});
  }
}

function stop() {
  try {
    if (detector) {
      detector.stop();
      detector.delete();
      if(imgPtr) {
        frame.delete();
        Module._free(imgPtr);
      }
      self.close();
      postMessage({"message":"stopped", "status": true});
    }
  }
  catch(err) {
    postMessage({"message": "stopped", "status": false, "detail": err});
  }
}
function start(data) {
  try
  {
    staticMode = data.staticMode;
    if (staticMode) {
      detector = new Module.PhotoDetector(data.faceMode);
    }
    else {
      detector = new Module.FrameDetector(data.processFPS, data.faceMode);
    }
    expressions = data.metrics.expressions;
    emotions = data.metrics.emotions;
    appearance = data.metrics.appearance;
    detectEmojis = data.detectEmojis;

    //Initialize the metrics to use
    for (var metricClass in data.metrics) {
      for (var indx in data.metrics[metricClass]) {
        var metric = data.metrics[metricClass][indx];
        detector["setDetect"+metric.capitalize()](true);
      }
    }

    if(detectEmojis) {
      detector.setDetectAllEmojis(true);
    }
    detector.start();
  }
  catch (e) {
    postMessage({"message":"started", "status": false, "detail": e});
  }
  postMessage({"message":"started", "status": true});
}

function processImg(img, timeStamp) {
  try {
    if(imgPtr === null) {
      var numBytes = img.width * img.height * 4;
      imgPtr = Module._malloc(numBytes);
      frame = new Module.Frame();
    }

    Module.HEAP8.set(img.data, imgPtr);
    frame.init(img.width, img.height, imgPtr, Module.COLOR_FORMAT.RGBA, Module.ROTATION.UPRIGHT, timeStamp);

    var message = {"message":"results", "img": img, "time": timeStamp, "status": true};

    var faces = detector.process(frame);

    if(imgPtr && staticMode) {
      frame.delete();
      Module._free(imgPtr);
      imgPtr = null;
      frame = null;
    }

    metrics = ["emotions", "expressions", "emojis"];
    message.faces = [];
    for (var indx = 0 ; indx < faces.size() ; indx++) {
      var face = faces.get(indx);
      data = {};
      for (var j = 0; j < metrics.length; j++) {
        data[metrics[j]] = {};
        this[metrics[j]].forEach( function(val, indx) {
          data[metrics[j]][val] = face[metrics[j]][val];
        });
      }

      data.emojis.dominantEmoji = emojiUnicode(face.emojis.dominantEmoji);
      data.appearance = {};
      appearance.forEach( function(val, idx) {
        data.appearance[val] = this[val+"Str"].call(null, face.appearance[val]);
      });

      data.measurements = {
        "interocularDistance": face.measurements.interocularDistance,
        "orientation": {
          "pitch": face.measurements.orientation.pitch,
          "yaw": face.measurements.orientation.yaw,
          "roll": face.measurements.orientation.roll
        }
      };

      data.featurePoints = {};
      var featurePoints = face.featurePoints;
      var featurePointsSize = face.featurePoints.size();
      for (i=0; i < featurePointsSize; i++) {
        data.featurePoints[i] = {
          "x": face.featurePoints.get(i).x,
          "y": face.featurePoints.get(i).y
        };
      }
      featurePoints.delete();

      message.faces.push(data);
    }
    postMessage(message);
  }
  catch(err) {
    var msg = "worker code reported an exception" + err;
    postMessage({"message": "results", "status": false,
                 "img": img, "time": timeStamp, "detail": msg});
  }
}

function emojiUnicode(e) {
  var ret = '';
  if (e) {
    ret = String.fromCodePoint(e.value);
  }
  return ret;
}

function genderStr(g) {
  var ret = '';
  if (Module.Gender) {
    if (g.value == Module.Gender.Female.value) ret = "Female";
    else if (g.value == Module.Gender.Male.value) ret = "Male";
    else if (g.value == Module.Gender.Unknown.value) ret = "Unknown";
  }
  return ret;
}

function ethnicityStr(g) {
  var ret = '';
  if (Module.Ethnicity) {
    if (g.value == Module.Ethnicity.CAUCASIAN.value) ret = "Caucasian";
    else if (g.value == Module.Ethnicity.BLACK_AFRICAN.value) ret = "Black African";
    else if (g.value == Module.Ethnicity.SOUTH_ASIAN.value) ret = "South Asian";
    else if (g.value == Module.Ethnicity.EAST_ASIAN.value) ret = "East Asian";
    else if (g.value == Module.Ethnicity.HISPANIC.value) ret = "Hispanic";
    else if (g.value == Module.Ethnicity.UNKNOWN.value) ret = "Unknown";
  }
  return ret;
}

function ageStr(g) {
  var ret = '';
  if (Module.Age) {
    if (g.value == Module.Age.AGE_UNKNOWN.value) ret = "Unknown";
    else if (g.value == Module.Age.AGE_UNDER_18.value) ret = "Under 18";
    else if (g.value == Module.Age.AGE_18_24.value) ret = "18 - 24";
    else if (g.value == Module.Age.AGE_25_34.value) ret = "25 - 34";
    else if (g.value == Module.Age.AGE_35_44.value) ret = "35 - 44";
    else if (g.value == Module.Age.AGE_45_54.value) ret = "45 - 54";
    else if (g.value == Module.Age.AGE_55_64.value) ret = "55 - 64";
    else if (g.value == Module.Age.AGE_65_PLUS.value) ret = "65+";
  }
  return ret;
}

function glassesStr(g) {
  var ret = '';
  if (Module.Glasses) {
    if (g.value == Module.Glasses.No.value) ret = "No";
    else if (g.value == Module.Glasses.Yes.value) ret = "Yes";
  }
  return ret;
}
