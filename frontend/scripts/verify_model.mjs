// One-off verification script: rebuilds the LSTM in TF.js from the exported
// weights and runs the same input the Python side will run, so we can diff
// the two outputs and confirm the browser port is numerically faithful.
import * as tf from '@tensorflow/tfjs'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MODEL_DIR = join(__dirname, '..', 'public', 'model')

function loadJson(name) {
  return JSON.parse(readFileSync(join(MODEL_DIR, name), 'utf-8'))
}

const meta = loadJson('model_meta.json')
const weights = loadJson('lstm_weights.json')
const scaler = loadJson('scaler.json')

function buildModel(meta) {
  const input = tf.input({ shape: [meta.sequence_length, meta.num_features] })
  const lstm = tf.layers
    .lstm({ units: 64, name: 'lstm', activation: 'tanh', recurrentActivation: 'sigmoid' })
    .apply(input)
  const dense = tf.layers.dense({ units: 32, activation: 'relu', name: 'dense' }).apply(lstm)
  const riskClass = tf.layers
    .dense({ units: meta.risk_levels.length, activation: 'softmax', name: 'risk_class' })
    .apply(dense)
  const riskScore = tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'risk_score' }).apply(dense)
  const forecast = tf.layers
    .dense({ units: meta.forecast_horizon, activation: 'sigmoid', name: 'forecast' })
    .apply(dense)
  return tf.model({ inputs: input, outputs: [riskClass, riskScore, forecast] })
}

const model = buildModel(meta)
for (const layerData of weights) {
  const layer = model.getLayer(layerData.name)
  const tensors = layerData.weights.map((w, i) => tf.tensor(w, layerData.shapes[i]))
  layer.setWeights(tensors)
}

// Fixed test sequence: 14 days, moderately heavy social/gaming usage, some
// compulsive checking, elevated late-night ratio, stress trending up.
const day = (i) => [
  90 + i * 2, // time_social_media
  40, // time_video_streaming
  20, // time_gaming
  60, // time_productivity
  10, // time_education
  15, // time_news
  5, // time_shopping
  25, // time_communication
  8, // time_other
  18 + i, // compulsive_check_count
  12, // tab_switch_frequency
  0.2 + i * 0.01, // late_night_ratio
  0.6, // active_idle_ratio
  22, // avg_session_length_min
  0, // daily_goal (study)
  0.55, // goal_alignment_score
  3, // mood_score
  3 + i * 0.05, // stress_score
  3, // sleep_quality
]

const sequence = Array.from({ length: 14 }, (_, i) => day(i))
const scaled = sequence.map((v) => v.map((val, i) => (val - scaler.mean[i]) / scaler.scale[i]))

const inputTensor = tf.tensor3d([scaled])
const [classProbsT, riskScoreT, forecastT] = model.predict(inputTensor)

const classProbs = await classProbsT.data()
const riskScore = await riskScoreT.data()
const forecast = await forecastT.data()

let classIdx = 0
for (let i = 1; i < classProbs.length; i++) if (classProbs[i] > classProbs[classIdx]) classIdx = i

console.log(JSON.stringify({
  risk_level: meta.risk_levels[classIdx],
  risk_score: riskScore[0],
  class_probs: Array.from(classProbs),
  forecast: Array.from(forecast),
  test_sequence: sequence,
}))
