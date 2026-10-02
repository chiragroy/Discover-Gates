import fs from 'fs';
import path from 'path';

interface LabelledPrompt {
  id: string;
  text: string;
  complexity: 'simple' | 'medium' | 'complex';
  category: 'legal' | 'accounting' | 'consulting';
}

const simplePrompts: Array<{ text: string; category: 'legal' | 'accounting' | 'consulting' }> = [
  // Legal simple
  { text: "Summarise this indemnity clause in plain English: Each party shall defend and indemnify the other against third party claims.", category: 'legal' },
  { text: "Fix the grammar and formatting in this notice of termination letter.", category: 'legal' },
  { text: "Convert this paragraph of legal terms into three clear bullet points for an executive summary.", category: 'legal' },
  { text: "What is the standard legal definition of 'force majeure' in New York law?", category: 'legal' },
  { text: "Proofread this confidentiality preamble for typographical errors.", category: 'legal' },
  { text: "Rephrase this boilerplate choice-of-law provision for readability.", category: 'legal' },
  { text: "Extract the signature block names and titles from this agreement snippet.", category: 'legal' },
  { text: "List the key dates mentioned in this four-sentence settlement notice.", category: 'legal' },
  { text: "Shorten this non-disclosure agreement definition of 'Confidential Information'.", category: 'legal' },
  { text: "Format this list of case citations into bluebook citation format.", category: 'legal' },
  { text: "Summarize this one-page engagement letter into two sentences.", category: 'legal' },
  { text: "Highlight the defined terms used in this warranty provision.", category: 'legal' },
  { text: "Reformat this legal billing narrative into past-tense active voice.", category: 'legal' },
  { text: "What is the difference between 'shall' and 'may' in contractual interpretation?", category: 'legal' },
  { text: "Draft a one-line subject heading for a trademark renewal notice.", category: 'legal' },
  { text: "Clean up the numbering hierarchy in this amended clause list.", category: 'legal' },
  { text: "Generate a standard document title for a mutual non-disclosure agreement.", category: 'legal' },
  { text: "Rewrite this sentence to avoid passive voice: 'Payment was made by the buyer.'", category: 'legal' },
  { text: "Extract all email addresses and phone numbers listed in this contract appendix.", category: 'legal' },
  { text: "Translate this Latin legal term 'inter alia' into plain corporate English.", category: 'legal' },

  // Accounting simple
  { text: "Summarize the key changes in this one-paragraph FASB standard update note.", category: 'accounting' },
  { text: "Format this table of monthly expense figures into markdown syntax.", category: 'accounting' },
  { text: "What does EBITDA stand for and how is it briefly described?", category: 'accounting' },
  { text: "Proofread this footnote description of inventory valuation methods.", category: 'accounting' },
  { text: "Convert this list of account balances into debit and credit columns.", category: 'accounting' },
  { text: "Shorten this management discussion paragraph on working capital changes.", category: 'accounting' },
  { text: "Define the term 'contra account' in simple terms for a business client.", category: 'accounting' },
  { text: "Draft a polite email asking a vendor for an updated W-9 form.", category: 'accounting' },
  { text: "Summarize these five audit meeting takeaways into bullet points.", category: 'accounting' },
  { text: "Format these tax year numbers with comma separators and currency symbols.", category: 'accounting' },
  { text: "What is the standard formula for calculating the current ratio?", category: 'accounting' },
  { text: "Rewrite this internal audit observation headline for clarity.", category: 'accounting' },
  { text: "List the standard components of a balance sheet in proper reporting order.", category: 'accounting' },
  { text: "Correct spelling mistakes in this schedule of depreciable assets.", category: 'accounting' },
  { text: "Convert this quarterly revenue list into percentage change descriptions.", category: 'accounting' },
  { text: "Draft an email notifying the finance team that payroll reconciliations are complete.", category: 'accounting' },
  { text: "What is the definition of 'materiality' according to PCAOB standards?", category: 'accounting' },
  { text: "Rephrase this tax filing extension confirmation for the client.", category: 'accounting' },
  { text: "Summarize this short paragraph on 1099-NEC reporting thresholds.", category: 'accounting' },
  { text: "Create a checklist table for standard month-end close reconciliations.", category: 'accounting' },

  // Consulting simple
  { text: "Condense this client interview transcript into five bulleted insights.", category: 'consulting' },
  { text: "Proofread these three slides of executive summary bullets.", category: 'consulting' },
  { text: "Draft an agenda for a 45-minute project kickoff steering meeting.", category: 'consulting' },
  { text: "Rephrase this problem statement into MECE (Mutually Exclusive, Collectively Exhaustive) phrasing.", category: 'consulting' },
  { text: "Convert these raw workshop notes into categorized thematic headers.", category: 'consulting' },
  { text: "Summarize the primary competitor strengths listed in this market snippet.", category: 'consulting' },
  { text: "Generate three alternative title options for a digital transformation roadmap report.", category: 'consulting' },
  { text: "Format this stakeholder analysis matrix into clean markdown.", category: 'consulting' },
  { text: "Shorten this consulting proposal scope description to 100 words.", category: 'consulting' },
  { text: "Fix repetitive wording in this project deliverables summary.", category: 'consulting' },
  { text: "Draft a brief thank-you note to a prospective client following a capability pitch.", category: 'consulting' },
  { text: "Extract action items and assignees from these meeting minutes.", category: 'consulting' },
  { text: "What does the RACI acronym stand for in project management?", category: 'consulting' },
  { text: "Reorder these workstream phases into chronological milestone order.", category: 'consulting' },
  { text: "Draft a follow-up email confirming delivery of the draft assessment report.", category: 'consulting' },
  { text: "Summarize these employee survey comments into three key sentiment themes.", category: 'consulting' },
  { text: "Proofread this fee quotation paragraph for correct professional tone.", category: 'consulting' },
  { text: "Generate bullet points highlighting cost reduction opportunities from this list.", category: 'consulting' },
  { text: "Clean up this list of consultant interview questions for readability.", category: 'consulting' },
  { text: "Convert these client quotes into pull-quotes for a presentation deck.", category: 'consulting' },
];

const mediumPrompts: Array<{ text: string; category: 'legal' | 'accounting' | 'consulting' }> = [
  // Legal medium
  { text: "Compare the limitation of liability provisions in Vendor Contract A versus Contract B.", category: 'legal' },
  { text: "Draft a standard set of representations and warranties for a software reseller agreement.", category: 'legal' },
  { text: "Analyze whether this non-compete clause is enforceable under California law.", category: 'legal' },
  { text: "Draft an assignment clause with customary exclusions for affiliate restructuring.", category: 'legal' },
  { text: "Prepare a due diligence checklist for intellectual property ownership in a tech acquisition.", category: 'legal' },
  { text: "Review this boilerplate severability clause and suggest revisions to protect key covenants.", category: 'legal' },
  { text: "Draft a notice of default letter for failure to pay commercial lease rent within cure period.", category: 'legal' },
  { text: "Identify missing protections in this third-party vendor data security schedule.", category: 'legal' },
  { text: "Explain the legal differences between joint liability and joint and several liability.", category: 'legal' },
  { text: "Draft a mutual release clause for a commercial dispute settlement agreement.", category: 'legal' },
  { text: "Assess whether this force majeure clause covers supply chain disruptions due to harbor strikes.", category: 'legal' },
  { text: "Draft a dispute resolution provision mandating mediation prior to AAA arbitration.", category: 'legal' },
  { text: "Evaluate whether this employment termination agreement complies with OWBPA requirements.", category: 'legal' },
  { text: "Review this indemnification procedure clause and identify any unrealistic notice timelines.", category: 'legal' },
  { text: "Draft an IP assignment confirmatory deed for a departed key contractor.", category: 'legal' },
  { text: "Summarize the legal obligations created by this cross-licensing patent agreement.", category: 'legal' },
  { text: "Compare standard Delaware versus New York indemnification carve-outs for gross negligence.", category: 'legal' },
  { text: "Draft standard audit rights language allowing client to inspect billing records annually.", category: 'legal' },
  { text: "Evaluate this termination for convenience clause and recommend reciprocal notice terms.", category: 'legal' },
  { text: "Prepare an issues list from this 15-page SaaS Master Services Agreement draft.", category: 'legal' },

  // Accounting medium
  { text: "Explain the five-step revenue recognition criteria under ASC 606 with practical examples.", category: 'accounting' },
  { text: "Evaluate whether this commercial equipment lease should be classified as operating or finance under ASC 842.", category: 'accounting' },
  { text: "Draft a technical accounting memorandum documenting the treatment of software development capitalization.", category: 'accounting' },
  { text: "Analyze the deferred tax asset valuation allowance criteria under ASC 740.", category: 'accounting' },
  { text: "Prepare an audit inquiry response letter detailing outstanding litigation contingencies.", category: 'accounting' },
  { text: "Explain how to calculate basic and diluted earnings per share with convertible debt.", category: 'accounting' },
  { text: "Review this business combination allocation schedule and evaluate goodwill calculation.", category: 'accounting' },
  { text: "Draft a management representation letter on internal controls over financial reporting.", category: 'accounting' },
  { text: "Analyze the accounting treatment for modifying stock options granted to employees.", category: 'accounting' },
  { text: "Assess the foreign currency translation adjustments under ASC 830 for European subsidiaries.", category: 'accounting' },
  { text: "Draft an explanation of the differences between IFRS 16 and US GAAP ASC 842 for lease accounting.", category: 'accounting' },
  { text: "Evaluate whether these debt refinancing fees should be expensed or capitalized under ASC 470.", category: 'accounting' },
  { text: "Prepare a memo outlining internal control deficiencies noted during payroll reconciliation testing.", category: 'accounting' },
  { text: "Explain the criteria for hedge accounting under ASC 815 for interest rate swaps.", category: 'accounting' },
  { text: "Review this schedule of inventory obsolescence reserves and assess methodology.", category: 'accounting' },
  { text: "Draft disclosure footnotes for significant concentrations of credit risk under ASC 275.", category: 'accounting' },
  { text: "Analyze whether revenue from variable consideration in contract milestones can be recognized.", category: 'accounting' },
  { text: "Draft audit confirmation procedures for accounts receivable balances above materiality.", category: 'accounting' },
  { text: "Evaluate the tax deductibility of executive compensation limits under IRC Section 162(m).", category: 'accounting' },
  { text: "Prepare a reconciliation analysis of statutory tax rates to effective corporate tax rates.", category: 'accounting' },

  // Consulting medium
  { text: "Develop a structured evaluation framework for selecting enterprise ERP vendors.", category: 'consulting' },
  { text: "Draft a change management strategy for a 2,000-person shared services reorganization.", category: 'consulting' },
  { text: "Conduct a Porter's Five Forces analysis of the regional hospital supply market.", category: 'consulting' },
  { text: "Prepare a detailed business case comparing on-premises data centers to cloud migration.", category: 'consulting' },
  { text: "Structure a work breakdown structure (WBS) for a post-merger integration workstream.", category: 'consulting' },
  { text: "Draft an executive briefing memo on supply chain resilience against geopolitical disruptions.", category: 'consulting' },
  { text: "Analyze customer churn drivers and recommend three targeted retention initiatives.", category: 'consulting' },
  { text: "Design a governance model and charter for an enterprise digital transformation PMO.", category: 'consulting' },
  { text: "Evaluate pricing strategy options for transitioning from perpetual licenses to SaaS subscriptions.", category: 'consulting' },
  { text: "Prepare a capability maturity assessment interview guide for IT operations leadership.", category: 'consulting' },
  { text: "Structure an operational cost reduction plan targeting 15% SG&A savings across three quarters.", category: 'consulting' },
  { text: "Draft key performance indicators (KPIs) for evaluating commercial sales force effectiveness.", category: 'consulting' },
  { text: "Synthesize findings from 12 customer interviews into a customer journey map narrative.", category: 'consulting' },
  { text: "Conduct a SWOT analysis for entering the renewable energy infrastructure sector.", category: 'consulting' },
  { text: "Prepare a communications plan addressing staff anxiety during an impending corporate buyout.", category: 'consulting' },
  { text: "Draft a risk assessment matrix for transitioning customer support to third-party offshore providers.", category: 'consulting' },
  { text: "Structure an organizational design workshop agenda for senior leadership alignment.", category: 'consulting' },
  { text: "Analyze the trade-offs between centralized versus decentralized procurement operating models.", category: 'consulting' },
  { text: "Prepare an RFP evaluation scorecard with weighted criteria across technical and commercial aspects.", category: 'consulting' },
  { text: "Draft a project charter defining scope, governance, milestones, and success criteria for an IT carve-out.", category: 'consulting' },
];

const complexPrompts: Array<{ text: string; category: 'legal' | 'accounting' | 'consulting' }> = [
  // Legal complex
  { text: "Draft our position on the counterparty's indemnity cap, referencing the clause above and market standards.", category: 'legal' },
  { text: "Prepare an appellate brief section arguing violation of the Commerce Clause in cross-border state tax regulation.", category: 'legal' },
  { text: "Draft a comprehensive legal memorandum analyzing whether board members breached their fiduciary duties under Caremark standards.", category: 'legal' },
  { text: "Construct a statutory interpretation argument regarding the definition of 'beneficial owner' under the Corporate Transparency Act.", category: 'legal' },
  { text: "Draft a hostile takeover defense memorandum evaluating poison pill adoption and staggered board protections under Delaware DGCL 141.", category: 'legal' },
  { text: "Analyze antitrust market definition arguments in a DOJ challenge to a merger between dominant enterprise CRM platforms.", category: 'legal' },
  { text: "Draft an intricate cross-border IP licensing and transfer pricing dispute settlement term sheet involving Swiss and US tax authorities.", category: 'legal' },
  { text: "Prepare a comprehensive legal opinion letter outline evaluating lender exposure under fraudulent transfer laws in an LBO restructuring.", category: 'legal' },
  { text: "Draft our position on arbitration waiver provisions under recent Supreme Court Federal Arbitration Act jurisprudence.", category: 'legal' },
  { text: "Formulate a defense strategy for a multinational corporation facing simultaneous parallel DOJ and SEC FCPA investigations.", category: 'legal' },
  { text: "Draft an indemnification carve-out provision with dedicated escrow mechanics and sandbagging protections for an M&A purchase agreement.", category: 'legal' },
  { text: "Analyze fiduciary duties of independent special litigation committees in shareholder derivative suits under New York law.", category: 'legal' },
  { text: "Draft our position paper opposing injunctive relief in a patent preliminary injunction proceeding regarding standard essential patents.", category: 'legal' },
  { text: "Construct a legal brief on the extraterritorial application of RICO statutes to foreign financial subsidiaries.", category: 'legal' },

  // Accounting complex
  { text: "Structure a cross-border tax structuring analysis for a technology conglomerate reallocating intangible property to Ireland.", category: 'accounting' },
  { text: "Draft a detailed technical accounting memorandum resolving complex revenue recognition for multi-element enterprise contracts containing embedded leases and milestone warranties.", category: 'accounting' },
  { text: "Analyze the statutory and tax implications of Section 382 net operating loss limitations following a multi-tier equity recapitalization.", category: 'accounting' },
  { text: "Formulate a forensic accounting investigation methodology to detect potential off-balance sheet SPV manipulations and round-trip revenue transactions.", category: 'accounting' },
  { text: "Draft a technical tax position paper analyzing whether a debt-for-equity swap qualifies as a tax-free reorganization under IRC Section 368(a)(1)(E).", category: 'accounting' },
  { text: "Perform a complex valuation impairment analysis under ASC 350 for a reporting unit experiencing declining EBITDA margins and interest rate escalation.", category: 'accounting' },
  { text: "Structure a detailed deferred tax inventory and uncertain tax position (UTP) reserve schedule under ASC 740-10 for global transfer pricing audits.", category: 'accounting' },
  { text: "Draft a comprehensive accounting position on de-recognition of financial liabilities following an in-substance defeasance transaction.", category: 'accounting' },
  { text: "Analyze BEPS Pillar Two global minimum tax compliance obligations and Top-up Tax calculations across 14 subsidiary jurisdictions.", category: 'accounting' },
  { text: "Draft a technical memorandum on purchase price allocation for an acquisition with customer relationship intangibles and assembled workforce valuation under ASC 805.", category: 'accounting' },
  { text: "Formulate an audit strategy and sample design for testing complex Level 3 fair value derivatives in a distressed regional bank portfolio.", category: 'accounting' },
  { text: "Analyze the accounting and tax ramifications of cross-border spin-offs involving distribution of controlled foreign corporation (CFC) stock under IRC Section 355.", category: 'accounting' },
  { text: "Draft our accounting position regarding consolidation of variable interest entities (VIEs) where the client holds subordinated debt but no equity.", category: 'accounting' },

  // Consulting complex
  { text: "Formulate a comprehensive market entry and post-merger integration playbook for a $10B private equity acquisition of a legacy industrial conglomerate.", category: 'consulting' },
  { text: "Draft an enterprise-wide turnaround strategy and reorganization plan for a distressed healthcare system facing operating deficits and union negotiations.", category: 'consulting' },
  { text: "Design a holistic digital business model transformation strategy evaluating generative AI disruption across corporate investment banking operations.", category: 'consulting' },
  { text: "Structure an intricate capital allocation framework balancing debt paydown, dividend policy, R&D reinvestment, and opportunistic M&A for a Fortune 100 CFO.", category: 'consulting' },
  { text: "Draft a global operational carve-out transition services agreement (TSA) strategy separating core IT infrastructure, supply chains, and HR systems.", category: 'consulting' },
  { text: "Construct an executive scenario-planning model evaluating severe stagflation, energy supply shock, and regulatory headwinds over a 5-year planning horizon.", category: 'consulting' },
  { text: "Design an end-to-end commercial transformation strategy optimizing pricing elasticity, discount governance, and incentive structures across 4,000 SKUs.", category: 'consulting' },
  { text: "Draft an agile organizational redesign blueprint restructuring a 20,000-employee global telecommunications enterprise from regional silos to customer product value streams.", category: 'consulting' },
  { text: "Formulate an M&A synergy realization roadmap with rigorous governance mechanisms to capture $250M in run-rate EBITDA improvements across procurement and logistics.", category: 'consulting' },
  { text: "Draft a crisis management and regulatory remediation framework for a multinational bank facing systemic operational risk sanctions.", category: 'consulting' },
  { text: "Structure a cross-functional ESG decarbonization roadmap aligning Scope 1, 2, and 3 emissions reduction targets with capital expenditure ROI thresholds.", category: 'consulting' },
  { text: "Analyze competitive dynamics and disruptive threats in autonomous supply chain logistics, recommending defensive joint ventures and technology acquisitions.", category: 'consulting' },
  { text: "Develop a comprehensive portfolio rationalization plan determining divestiture candidates, hold-for-value assets, and core growth platforms for a multi-sector conglomerate.", category: 'consulting' },
  { text: "Draft a Board of Directors strategy deck on enterprise cloud migration risks, cybersecurity posture, and multi-year IT operational resilience.", category: 'consulting' },
];

const allPrompts: LabelledPrompt[] = [];
let counter = 1;

for (const p of simplePrompts) {
  allPrompts.push({
    id: `p-${String(counter++).padStart(3, '0')}`,
    text: p.text,
    complexity: 'simple',
    category: p.category,
  });
}

for (const p of mediumPrompts) {
  allPrompts.push({
    id: `p-${String(counter++).padStart(3, '0')}`,
    text: p.text,
    complexity: 'medium',
    category: p.category,
  });
}

for (const p of complexPrompts) {
  allPrompts.push({
    id: `p-${String(counter++).padStart(3, '0')}`,
    text: p.text,
    complexity: 'complex',
    category: p.category,
  });
}

const outputPath = path.join(process.cwd(), 'seed', 'labelled-prompts.json');
fs.writeFileSync(outputPath, JSON.stringify(allPrompts, null, 2), 'utf-8');

console.log(`Generated ${allPrompts.length} labelled prompts into ${outputPath}`);
console.log(`Counts: Simple=${simplePrompts.length}, Medium=${mediumPrompts.length}, Complex=${complexPrompts.length}`);
