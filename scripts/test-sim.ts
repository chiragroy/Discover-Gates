import { computeEmbedding } from '../src/lib/embeddings';
import { cosineSimilarity } from '../src/lib/db';

async function test() {
  const e1 = await computeEmbedding('Summarise that indemnity clause in plain English');
  const e2 = await computeEmbedding('Can you put that indemnity clause into plain language?');
  const e3 = await computeEmbedding('Summarise this indemnity clause in plain English: Each party shall defend and indemnify the other against third party claims.');

  console.log('e1 ("Summarise that indemnity clause in plain English")');
  console.log('vs e2 ("Can you put that indemnity clause into plain language?"):', cosineSimilarity(e1, e2).toFixed(4));
  console.log('e2 vs e3 (with clause included):', cosineSimilarity(e2, e3).toFixed(4));
}

test();
