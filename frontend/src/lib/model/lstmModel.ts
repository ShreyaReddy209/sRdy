/**
 * Loads the trained LSTM (exported once from Keras via ml/export_for_browser.py)
 * and reconstructs it with TensorFlow.js so inference runs entirely in the browser —
 * no backend server required. Same architecture, same trained weights, same math.
 */
import * as tf from '@tensorflow/tfjs'

export interface ModelMeta {
  sequence_length: number
  forecast_horizon: number
  num_features: number
  feature_names: string[]
  risk_levels: string[]
}

interface LayerWeights {
  name: string
  className: string
  weights: unknown[]
  shapes: number[][]
}

export interface ModelAssets {
  model: tf.LayersModel
  meta: ModelMeta
  scalerMean: number[]
  scalerScale: number[]
}

let cached: Promise<ModelAssets> | null = null

function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/'
  return `${base.endsWith('/') ? base : `${base}/`}model/${path}`
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(assetUrl(path))
  if (!res.ok) throw new Error(`Failed to fetch model asset ${path}: ${res.status}`)
  return res.json() as Promise<T>
}

/** Mirrors ml/train_lstm.py's build_model(): LSTM(64) -> Dense(32, relu) -> 3 output heads. */
function buildModel(meta: ModelMeta): tf.LayersModel {
  const input = tf.input({ shape: [meta.sequence_length, meta.num_features] })
  // Keras's LSTM defaults to recurrentActivation: 'sigmoid', but tfjs-layers defaults to
  // 'hardSigmoid' — without this override the ported model silently drifts a few percent
  // off the original Python predictions. Verified bit-for-bit identical with this set.
  const lstm = tf.layers
    .lstm({ units: 64, name: 'lstm', activation: 'tanh', recurrentActivation: 'sigmoid' })
    .apply(input) as tf.SymbolicTensor
  const dense = tf.layers.dense({ units: 32, activation: 'relu', name: 'dense' }).apply(lstm) as tf.SymbolicTensor
  const riskClass = tf.layers
    .dense({ units: meta.risk_levels.length, activation: 'softmax', name: 'risk_class' })
    .apply(dense) as tf.SymbolicTensor
  const riskScore = tf.layers
    .dense({ units: 1, activation: 'sigmoid', name: 'risk_score' })
    .apply(dense) as tf.SymbolicTensor
  const forecast = tf.layers
    .dense({ units: meta.forecast_horizon, activation: 'sigmoid', name: 'forecast' })
    .apply(dense) as tf.SymbolicTensor
  return tf.model({ inputs: input, outputs: [riskClass, riskScore, forecast] })
}

function applyWeights(model: tf.LayersModel, layers: LayerWeights[]): void {
  for (const layerData of layers) {
    const layer = model.getLayer(layerData.name)
    const tensors = layerData.weights.map((w, i) => tf.tensor(w as number[], layerData.shapes[i]))
    layer.setWeights(tensors)
  }
}

export async function loadModel(): Promise<ModelAssets> {
  if (!cached) {
    cached = (async () => {
      const [meta, weights, scaler] = await Promise.all([
        fetchJson<ModelMeta>('model_meta.json'),
        fetchJson<LayerWeights[]>('lstm_weights.json'),
        fetchJson<{ mean: number[]; scale: number[] }>('scaler.json'),
      ])
      const model = buildModel(meta)
      applyWeights(model, weights)
      return { model, meta, scalerMean: scaler.mean, scalerScale: scaler.scale }
    })().catch((err) => {
      cached = null
      throw err
    })
  }
  return cached
}
