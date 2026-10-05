import { Tier } from '@/config/pricing';

/**
 * Realistic mock response used by every provider when no API key is configured
 * or the live call fails, so the app remains fully demonstrable offline.
 */
export function generateProfessionalMockAnswer(prompt: string, tier: Tier): string {
  const p = prompt.toLowerCase();
  if (p.includes('summarise') || p.includes('summarize')) {
    return (
      `**Summary:** The provision establishes a reciprocal indemnity obligation between the parties, ` +
      `capping maximum liability to the total aggregate fees paid under the Agreement in the preceding 12 months, ` +
      `expressly carving out gross negligence, willful misconduct, and breaches of confidentiality.`
    );
  }
  if (p.includes('indemnity cap') || p.includes('position')) {
    return (
      `**Position Memorandum: Indemnity Cap Negotiation**\n\n` +
      `1. **Standard Recommendation:** We recommend rejecting the counterparty's proposed uncapped indemnity for indirect damages.\n` +
      `2. **Market Position:** Commercial standard in software procurement limits aggregate exposure to 1x–2x 12-month trailing contract value.\n` +
      `3. **Carve-out Strategy:** Concede IP infringement and data breach carve-outs only subject to a distinct 'super-cap' of 3x contract value.`
    );
  }
  if (tier === 'deep') {
    return (
      `**Statutory & Contractual Analysis:**\n\n` +
      `Based on the provided facts and governing jurisdiction principles:\n` +
      `• **Primary Obligation:** The operative terms mandate compliance with statutory disclosure thresholds.\n` +
      `• **Risk Allocation:** The current draft allocates disproportionate consequential risk to our client.\n` +
      `• **Recommended Revision:** Insert an express knowledge qualifier and shorten the notice cure window to 15 business days.`
    );
  }
  return (
    `Based on professional review of your query regarding "${prompt.slice(0, 45)}...":\n` +
    `The operative terms comply with regulatory requirements. Proceed with standard documentation while noting client disclosure requirements.`
  );
}
