import { pipeline, FeatureExtractionPipeline } from '@huggingface/transformers';

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Returns singleton feature-extraction pipeline for Xenova/all-MiniLM-L6-v2 (384-dim).
 * Loads model into memory once per process.
 */
export async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      dtype: 'fp32',
    });
  }
  return pipelinePromise;
}

/**
 * Computes a 384-dimensional normalized embedding for input text.
 */
export async function computeEmbedding(text: string): Promise<Float32Array> {
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Float32Array.from(output.data as unknown as ArrayLike<number>);
}
