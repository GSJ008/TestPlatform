/* eslint-disable no-restricted-globals */
// This worker handles ONLY device/object detection (coco-ssd), which is pure
// TF.js with no DOM dependency and works fine in a Worker context.
//
// Face detection (face-api.js) is NOT included here - that library's
// environment auto-detection (isBrowser()/isNodejs()) can never succeed
// inside a Worker, since a Worker has no `window`/`document`/HTMLImageElement
// etc, and isn't Node.js either. This is a hard limitation of the library
// itself, not something fixable from our side. Face detection runs on the
// main thread instead (see QuestionPage.js), on a longer interval to keep
// its cost manageable.

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

let detector = null;
let modelsReady = false;

const MIN_SCORE = 0.45;
const WATCHED_CLASSES = ["cell phone", "laptop", "tablet", "remote", "book"];

async function loadModels() {
  await tf.setBackend("cpu");
  await tf.ready();

  detector = await cocoSsd.load();

  modelsReady = true;
  self.postMessage({ type: "models-ready" });
}

async function runDetection(imageBitmap, requestId) {
  if (!modelsReady) {
    self.postMessage({ type: "result", requestId, error: "Models not ready yet" });
    return;
  }

  try {
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imageBitmap, 0, 0);
    imageBitmap.close();

    const predictions = await detector.detect(canvas);
    const detectedDevices = predictions
      .filter((p) => WATCHED_CLASSES.includes(p.class) && p.score >= MIN_SCORE)
      .map((p) => p.class);

    self.postMessage({
      type: "result",
      requestId,
      devices: detectedDevices
    });
  } catch (err) {
    self.postMessage({ type: "result", requestId, error: err.message });
  }
}

self.onmessage = async (e) => {
  const { type } = e.data;

  if (type === "load-models") {
    try {
      await loadModels();
    } catch (err) {
      self.postMessage({ type: "models-error", error: err.message });
    }
  }

  if (type === "detect") {
    runDetection(e.data.imageBitmap, e.data.requestId);
  }
};