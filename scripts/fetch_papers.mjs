#!/usr/bin/env node
import { XMLParser } from "fast-xml-parser";
import { writeFileSync, readFileSync, existsSync, readdirSync } from "fs";
import { join, basename } from "path";

const PUBMED_SEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_FETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const USER_AGENT = "HighlySensitiveBot/1.0 (research aggregator)";

const BASE_QUERY = `("sensory processing sensitivity"[tiab] OR "sensory-processing sensitivity"[tiab] OR "environmental sensitivity"[tiab] OR "highly sensitive person"[tiab] OR "highly sensitive people"[tiab] OR "highly sensitive child"[tiab] OR "Highly Sensitive Person Scale"[tiab] OR HSPS[tiab] OR "Highly Sensitive Child Scale"[tiab] OR HSCS[tiab] OR "sensory processing sensitivity questionnaire"[tiab] OR SPSQ[tiab])`;

const THEORY_QUERY = `("differential susceptibility"[tiab] OR "vantage sensitivity"[tiab] OR "biological sensitivity to context"[tiab])`;

function getDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10).replace(/-/g, "/");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { days: 7, maxPapers: 50, output: "papers.json" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) opts.days = parseInt(args[i + 1]);
    if (args[i] === "--max-papers" && args[i + 1]) opts.maxPapers = parseInt(args[i + 1]);
    if (args[i] === "--output" && args[i + 1]) opts.output = args[i + 1];
  }
  return opts;
}

function collectExistingPmids(docsDir) {
  const pmids = new Set();
  if (!existsSync(docsDir)) return pmids;
  const files = readdirSync(docsDir).filter(f => f.startsWith("sensitivity-") && f.endsWith(".json"));
  files.sort().reverse();
  const recent = files.slice(0, 7);
  for (const f of recent) {
    try {
      const data = JSON.parse(readFileSync(join(docsDir, f), "utf-8"));
      for (const p of data.papers || []) {
        if (p.pmid) pmids.add(p.pmid);
      }
    } catch {}
  }
  return pmids;
}

async function searchPapers(query, retmax) {
  const url = `${PUBMED_SEARCH}?db=pubmed&term=${encodeURIComponent(query)}&retmax=${retmax}&sort=date&retmode=json`;
  console.error(`[INFO] Searching PubMed...`);
  const resp = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`PubMed search HTTP ${resp.status}`);
  const data = await resp.json();
  return data?.esearchresult?.idlist || [];
}

async function fetchDetails(pmids) {
  if (!pmids.length) return [];
  const ids = pmids.join(",");
  const url = `${PUBMED_FETCH}?db=pubmed&id=${ids}&retmode=xml`;
  console.error(`[INFO] Fetching details for ${pmids.length} papers...`);
  const resp = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60000) });
  if (!resp.ok) throw new Error(`PubMed fetch HTTP ${resp.status}`);
  const xml = await resp.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const root = parser.parse(xml);
  const articles = root?.PubmedArticleSet?.PubmedArticle || [];
  const list = Array.isArray(articles) ? articles : [articles];
  const papers = [];
  for (const item of list) {
    try {
      const medline = item.MedlineCitation;
      if (!medline) continue;
      const art = medline.Article;
      if (!art) continue;
      const title = art.ArticleTitle || "";
      let abstract = "";
      const absTexts = art.Abstract?.AbstractText;
      if (absTexts) {
        const parts = Array.isArray(absTexts) ? absTexts : [absTexts];
        for (const p of parts) {
          if (typeof p === "string") abstract += p + " ";
          else if (p["#text"]) {
            const label = p["@_Label"];
            abstract += label ? `${label}: ${p["#text"]} ` : `${p["#text"]} `;
          }
        }
      }
      abstract = abstract.trim().slice(0, 2000);
      const journal = art.Journal?.Title || "";
      const pubDate = art.Journal?.JournalIssue?.PubDate;
      let dateStr = "";
      if (pubDate) {
        const y = pubDate.Year || "";
        const m = pubDate.Month || "";
        const d = pubDate.Day || "";
        dateStr = [y, m, d].filter(Boolean).join(" ");
      }
      const pmid = String(medline.PMID || "");
      const link = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "";
      const keywords = [];
      const kwList = medline.KeywordList;
      if (kwList) {
        const kws = Array.isArray(kwList) ? kwList.flatMap(k => Array.isArray(k.Keyword) ? k.Keyword : [k.Keyword]) : (kwList.Keyword ? (Array.isArray(kwList.Keyword) ? kwList.Keyword : [kwList.Keyword]) : []);
        for (const k of kws) {
          if (typeof k === "string") keywords.push(k);
          else if (k?.["#text"]) keywords.push(k["#text"]);
        }
      }
      papers.push({ pmid, title, journal, date: dateStr, abstract, url: link, keywords });
    } catch (e) {
      console.error(`[WARN] Failed to parse article: ${e.message}`);
    }
  }
  return papers;
}

async function main() {
  const opts = parseArgs();
  const docsDir = join(process.cwd(), "docs");
  const existingPmids = collectExistingPmids(docsDir);
  console.error(`[INFO] Found ${existingPmids.size} PMIDs in recent reports`);

  const lookback = getDateDaysAgo(opts.days);
  const dateFilter = `"${lookback}"[Date - Publication] : "3000"[Date - Publication]`;
  const query = `((${BASE_QUERY}) OR (${THEORY_QUERY})) AND ${dateFilter}`;

  let pmids = await searchPapers(query, opts.maxPapers);
  console.error(`[INFO] Found ${pmids.length} papers from PubMed`);

  const newPmids = pmids.filter(id => !existingPmids.has(id));
  console.error(`[INFO] After dedup: ${newPmids.length} new papers`);

  if (newPmids.length === 0) {
    console.error("[WARN] No new papers found");
    const emptyData = {
      date: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
      count: 0,
      papers: [],
    };
    writeFileSync(opts.output, JSON.stringify(emptyData, null, 2));
    return;
  }

  const papers = await fetchDetails(newPmids);
  console.error(`[INFO] Fetched details for ${papers.length} papers`);

  const tzOffset = 8 * 3600000;
  const today = new Date(Date.now() + tzOffset).toISOString().slice(0, 10);
  const outputData = { date: today, count: papers.length, papers };
  writeFileSync(opts.output, JSON.stringify(outputData, null, 2));
  console.error(`[INFO] Saved to ${opts.output}`);
}

main().catch(e => {
  console.error(`[ERROR] ${e.message}`);
  process.exit(1);
});
