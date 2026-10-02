import { computeEmbedding } from '../src/lib/embeddings';

async function warm() {
  console.log('--- WARMING LOCAL EMBEDDING MODEL ---');
  console.log('Downloading/loading Xenova/all-MiniLM-L6-v2 ONNX model...');
  const start = performance.now();
  const testText = 'Gatehouse pre-flight gate chain for LLM calls in professional services.';
  const embedding = await computeEmbedding(testText);
  const duration = performance.now() - start;

  console.log(`Success! Embedding computed.`);
  console.log(`Dimensions: ${embedding.length}`);
  console.log(`First 5 values: ${Array.from(embedding.slice(0, 5)).map(v => v.toFixed(4)).join(', ')}`);
  console.log(`Total warm latency: ${duration.toFixed(1)}ms`);

  // Run a second quick call to test warm cache speed
  const secondStart = performance.now();
  await computeEmbedding('Second test sentence for warm speed check.');
  const secondDuration = performance.now() - secondStart;
  console.log(`Warm cache latency: ${secondDuration.toFixed(1)}ms (Target < 150ms)`);
}

warm().catch(err => {
  console.error('Model warming failed:', err);
  process.exit(1);
});
