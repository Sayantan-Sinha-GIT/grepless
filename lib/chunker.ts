// Splits a source file into search-sized chunks that follow the syntax tree:
// one chunk per function / class / method where possible, small neighbours
// (imports, constants, tiny helpers) merged together, and oversized nodes
// split along their children. Files without a grammar fall back to headings
// (Markdown) or overlapping line windows.

import path from 'node:path';
import { createRequire } from 'node:module';
import type * as TS from '@vscode/tree-sitter-wasm';
import type { Grammar, LanguageInfo } from './languages';

export interface Chunk {
  startLine: number; // 1-based, inclusive
  endLine: number; // 1-based, inclusive
  symbol: string | null;
  kind: string;
  content: string;
}

export const MAX_CHARS = 1500;
const MIN_CHARS = 350;
const MAX_CHUNKS_PER_FILE = 120;

type TreeSitterModule = typeof TS;
type SyntaxNode = TS.Node;

let runtime: Promise<{ mod: TreeSitterModule; dir: string }> | null = null;
const languages = new Map<Grammar, Promise<TS.Language>>();

function loadRuntime() {
  runtime ??= (async () => {
    // Resolve from the project root: bundlers rewrite import.meta.url / __filename
    // for external packages, which breaks the WASM file lookup.
    const dir = path.join(process.cwd(), 'node_modules', '@vscode', 'tree-sitter-wasm', 'wasm');
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    const mod = require(path.join(dir, 'tree-sitter.js')) as TreeSitterModule;
    await mod.Parser.init({ locateFile: (file: string) => path.join(dir, file) });
    return { mod, dir };
  })();
  return runtime;
}

async function parserFor(grammar: Grammar): Promise<TS.Parser> {
  const { mod, dir } = await loadRuntime();
  let lang = languages.get(grammar);
  if (!lang) {
    lang = mod.Language.load(path.join(dir, `tree-sitter-${grammar}.wasm`));
    languages.set(grammar, lang);
  }
  const parser = new mod.Parser();
  parser.setLanguage(await lang);
  return parser;
}

// ---------------------------------------------------------------------------
// Line bookkeeping

class Lines {
  readonly lines: string[];
  private readonly offsets: number[];
  constructor(text: string) {
    this.lines = text.split('\n');
    this.offsets = [0];
    for (const l of this.lines) this.offsets.push(this.offsets[this.offsets.length - 1] + l.length + 1);
  }
  get count() {
    return this.lines.length;
  }
  /** Characters in rows [start, end] (0-based, inclusive). */
  size(start: number, end: number) {
    return this.offsets[end + 1] - this.offsets[start];
  }
  slice(start: number, end: number) {
    return this.lines.slice(start, end + 1).join('\n');
  }
}

interface Range {
  start: number; // 0-based rows, inclusive
  end: number;
  symbols: string[];
  kind: string;
}

// ---------------------------------------------------------------------------
// Definition detection (works across the bundled grammars)

const DEF_RE =
  /(function|method|class|interface|struct|enum|trait|impl_item|mod_item|module|namespace|type_alias|type_declaration|type_item|constructor|record|singleton_method|rule_set|keyframes)/;
const NOT_DEF_RE = /(call|invocation|expression|parameter|argument|identifier|reference|modifier|body|signature_help)/;

function kindOf(type: string): string {
  if (type.includes('interface')) return 'interface';
  if (type.includes('class') || type.includes('record')) return 'class';
  if (type.includes('method') || type.includes('constructor')) return 'method';
  if (type.includes('function') || type.includes('arrow')) return 'function';
  if (type.includes('struct')) return 'struct';
  if (type.includes('enum')) return 'enum';
  if (type.includes('trait')) return 'trait';
  if (type.includes('impl')) return 'impl';
  if (type.includes('module') || type.includes('namespace') || type.includes('mod_item')) return 'module';
  if (type.includes('rule_set') || type.includes('keyframes')) return 'style';
  if (type.includes('type')) return 'type';
  return 'block';
}

function namedChildren(node: SyntaxNode): SyntaxNode[] {
  return node.namedChildren.filter((c): c is SyntaxNode => c !== null);
}

/** Strips `export …` / decorators so we look at the real declaration. */
function unwrap(node: SyntaxNode): SyntaxNode {
  if (/^(export_statement|decorated_definition|export_declaration|template_declaration)$/.test(node.type)) {
    const inner =
      node.childForFieldName('declaration') ??
      node.childForFieldName('definition') ??
      namedChildren(node).find((c) => DEF_RE.test(c.type) || /declaration|definition/.test(c.type));
    if (inner) return inner;
  }
  return node;
}

function declaratorName(node: SyntaxNode | null): SyntaxNode | null {
  let d = node;
  for (let i = 0; d && i < 6; i++) {
    if (/identifier$|^name$|operator_name|destructor_name/.test(d.type)) return d;
    d = d.childForFieldName('declarator') ?? d.childForFieldName('name') ?? namedChildren(d)[0] ?? null;
  }
  return null;
}

const TEST_CALL_RE = /^(test|it|describe|suite|context|specify|bench)(\.\w+)*$/;

function definitionOf(raw: SyntaxNode, inFunction = false): { name: string; kind: string } | null {
  const node = unwrap(raw);
  if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
    const decl = namedChildren(node).find((c) => c.type === 'variable_declarator');
    const name = decl?.childForFieldName('name')?.text;
    const value = decl?.childForFieldName('value');
    if (!name || name.length > 80 || /^[[{]/.test(name)) return null;
    if (value && /function|arrow|class/.test(value.type)) {
      return { name, kind: value.type.includes('class') ? 'class' : 'function' };
    }
    // Module- and class-level constants are worth naming; locals inside a function are not.
    return inFunction ? null : { name, kind: 'variable' };
  }
  if (node.type === 'expression_statement') {
    const expr = namedChildren(node)[0];
    // res.sendFile = function sendFile() {…} / module.exports = class Foo {…}
    if (expr?.type === 'assignment_expression') {
      const left = expr.childForFieldName('left')?.text;
      const right = expr.childForFieldName('right');
      if (!left || left.length > 80 || !right || !/function|arrow|class/.test(right.type)) return null;
      const name = left.replace(/^module\.exports\.?|^exports\./, '') || 'module.exports';
      return { name, kind: right.type.includes('class') ? 'class' : 'function' };
    }
    // test('does x', …) / describe('Foo', …) blocks in JS/TS test suites.
    const call = expr;
    if (call?.type !== 'call_expression') return null;
    const fn = call.childForFieldName('function')?.text ?? '';
    if (!TEST_CALL_RE.test(fn)) return null;
    const args = call.childForFieldName('arguments');
    const first = args ? namedChildren(args)[0] : undefined;
    const label = first && /string|template/.test(first.type) ? first.text.slice(1, -1).slice(0, 60) : '';
    return { name: label ? `${fn.split('.')[0]} "${label}"` : fn, kind: 'test' };
  }
  if (!DEF_RE.test(node.type) || NOT_DEF_RE.test(node.type)) return null;
  let nameNode =
    node.childForFieldName('name') ?? (node.type === 'impl_item' ? node.childForFieldName('type') : null);
  if (!nameNode && node.type === 'type_declaration') {
    nameNode = namedChildren(node).find((c) => c.type === 'type_spec')?.childForFieldName('name') ?? null;
  }
  if (!nameNode && node.type === 'rule_set') nameNode = namedChildren(node)[0] ?? null;
  if (!nameNode) nameNode = declaratorName(node.childForFieldName('declarator'));
  if (!nameNode) return null;
  const name = nameNode.text.replace(/\s+/g, ' ').slice(0, 80);
  return name ? { name, kind: kindOf(node.type) } : null;
}

/** Where to look for sub-chunks when a node is too big to keep whole. */
function descendTarget(raw: SyntaxNode): SyntaxNode {
  let node = unwrap(raw);
  if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
    const value = namedChildren(node)
      .find((c) => c.type === 'variable_declarator')
      ?.childForFieldName('value');
    if (value) node = value;
  }
  if (node.type === 'expression_statement') {
    const expr = namedChildren(node)[0];
    if (expr?.type === 'assignment_expression') {
      node = expr.childForFieldName('right') ?? node;
    } else if (expr?.type === 'call_expression') {
      // describe('x', function () { … }) → look inside the callback.
      const args = expr.childForFieldName('arguments');
      const callback = args ? namedChildren(args).reverse().find((a) => /function|arrow/.test(a.type)) : undefined;
      if (callback) node = callback;
    }
  }
  return node.childForFieldName('body') ?? node;
}

function endRow(node: SyntaxNode) {
  const { row, column } = node.endPosition;
  return column === 0 && row > node.startPosition.row ? row - 1 : row;
}

// ---------------------------------------------------------------------------
// Chunking strategies

function lineWindows(lines: Lines, start: number, end: number, symbols: string[], kind: string): Range[] {
  const out: Range[] = [];
  let s = start;
  while (s <= end) {
    let e = s;
    while (e < end && lines.size(s, e + 1) <= MAX_CHARS && e - s < 80) e++;
    out.push({ start: s, end: e, symbols, kind });
    if (e >= end) break;
    s = Math.max(e - 3, s + 1); // small overlap keeps context across the cut
  }
  return out;
}

function walk(node: SyntaxNode, lines: Lines, context: string[], inFunction = false, inClass = false): Range[] {
  const out: Range[] = [];
  let group: (Range & { bigDef: boolean }) | null = null;

  const flush = () => {
    if (group) out.push(group);
    group = null;
  };

  for (const child of namedChildren(node)) {
    const start = child.startPosition.row;
    const end = endRow(child);
    const size = lines.size(start, end);
    const found = definitionOf(child, inFunction);
    const def = found && inClass && found.kind === 'function' ? { ...found, kind: 'method' } : found;
    // Test names are sentences; keep only the nearest enclosing block for context.
    const qualified = def
      ? [...(def.kind === 'test' ? context.slice(-1) : context), def.name].join(def.kind === 'test' ? ' › ' : '.')
      : null;

    if (size > MAX_CHARS) {
      flush();
      const target = descendTarget(child);
      const inner = qualified ? [...context, def!.name] : context;
      const innerFn = inFunction || /function|method|test/.test(def?.kind ?? '');
      let subs = target !== child || namedChildren(child).length > 1 ? walk(target, lines, inner, innerFn, def?.kind === 'class') : [];
      if (subs.length === 0) {
        subs = lineWindows(lines, start, end, qualified ? [qualified] : context.slice(-1), def?.kind ?? 'block');
      } else {
        // Keep the signature line(s) and closing brace attached to the pieces.
        if (lines.size(start, subs[0].end) <= MAX_CHARS * 1.3) subs[0].start = Math.min(subs[0].start, start);
        const last = subs[subs.length - 1];
        if (lines.size(last.start, end) <= MAX_CHARS * 1.3) last.end = Math.max(last.end, end);
        for (const s of subs) {
          if (s.symbols.length === 0 && qualified) s.symbols = [qualified];
          if (s.kind === 'block' && def) s.kind = def.kind;
        }
      }
      out.push(...subs);
      continue;
    }

    const current: (Range & { bigDef: boolean }) | null = group;
    if (current) {
      const groupSize = lines.size(current.start, current.end);
      const combined = lines.size(current.start, end);
      const merge = combined <= MAX_CHARS && (groupSize < MIN_CHARS || (size < MIN_CHARS && !current.bigDef));
      if (merge) {
        current.end = Math.max(current.end, end);
        if (qualified) {
          current.symbols.push(qualified);
          if (current.kind === 'block' || current.kind === 'imports') current.kind = def!.kind;
        }
        current.bigDef ||= !!def && size >= MIN_CHARS;
        continue;
      }
      flush();
    }
    group = {
      start,
      end,
      symbols: qualified ? [qualified] : [],
      kind: def?.kind ?? (/import|include|use_declaration|require|package/.test(child.type) ? 'imports' : 'block'),
      bigDef: !!def && size >= MIN_CHARS,
    };
  }
  flush();
  return out;
}

function markdownSections(lines: Lines): Range[] {
  const sections: Range[] = [];
  let current: Range = { start: 0, end: 0, symbols: [], kind: 'section' };
  let inFence = false;
  lines.lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const heading = !inFence && /^#{1,6}\s+(.+)/.exec(line);
    if (heading && i > current.start) {
      current.end = i - 1;
      sections.push(current);
      current = { start: i, end: i, symbols: [heading[1].trim().slice(0, 80)], kind: 'section' };
    } else if (heading) {
      current.symbols = [heading[1].trim().slice(0, 80)];
    }
  });
  current.end = lines.count - 1;
  sections.push(current);

  const out: Range[] = [];
  for (const s of sections) {
    const prev = out[out.length - 1];
    if (prev && lines.size(prev.start, s.end) <= MIN_CHARS * 2) {
      prev.end = s.end;
      continue;
    }
    if (lines.size(s.start, s.end) > MAX_CHARS) out.push(...lineWindows(lines, s.start, s.end, s.symbols, 'section'));
    else out.push(s);
  }
  return out;
}

/** Folds slivers (a closing brace, a one-line tail) into their neighbour. */
function coalesce(ranges: Range[], lines: Lines): Range[] {
  const out: Range[] = [];
  for (const r of ranges) {
    const prev = out[out.length - 1];
    const small = (x: Range) => lines.size(x.start, x.end) < MIN_CHARS / 2;
    if (prev && r.start <= prev.end + 2 && (small(prev) || small(r)) && lines.size(prev.start, Math.max(prev.end, r.end)) <= MAX_CHARS) {
      prev.end = Math.max(prev.end, r.end);
      prev.symbols.push(...r.symbols);
      if (prev.kind === 'block' || prev.kind === 'imports') prev.kind = r.kind;
      continue;
    }
    out.push({ ...r, symbols: [...r.symbols] });
  }
  return out;
}

function finalize(ranges: Range[], lines: Lines): Chunk[] {
  const chunks: Chunk[] = [];
  for (const r of coalesce(ranges, lines)) {
    let { start, end } = r;
    while (start < end && lines.lines[start].trim() === '') start++;
    while (end > start && lines.lines[end].trim() === '') end--;
    const content = lines.slice(start, end);
    if (content.trim().length < 25) continue;
    const symbols = [...new Set(r.symbols)];
    chunks.push({
      startLine: start + 1,
      endLine: end + 1,
      symbol: symbols.length
        ? (symbols.slice(0, 3).join(', ') + (symbols.length > 3 ? ` +${symbols.length - 3}` : '')).slice(0, 160)
        : null,
      kind: r.kind,
      content,
    });
    if (chunks.length >= MAX_CHUNKS_PER_FILE) break;
  }
  return chunks;
}

export async function chunkFile(text: string, info: LanguageInfo): Promise<Chunk[]> {
  const normalized = text.replace(/\r\n?/g, '\n');
  const lines = new Lines(normalized);
  if (normalized.length <= MAX_CHARS && info.strategy !== 'markdown') {
    return finalize([{ start: 0, end: lines.count - 1, symbols: [], kind: 'file' }], lines).map((c) => ({
      ...c,
      kind: 'file',
    }));
  }

  if (info.strategy === 'markdown') return finalize(markdownSections(lines), lines);

  if (info.strategy === 'ast' && info.grammar) {
    let parser: TS.Parser | null = null;
    let tree: TS.Tree | null = null;
    try {
      parser = await parserFor(info.grammar);
      tree = parser.parse(normalized);
      if (tree) {
        const ranges = walk(tree.rootNode, lines, []);
        if (ranges.length) return finalize(ranges, lines);
      }
    } catch (err) {
      console.warn(`[chunker] tree-sitter failed for ${info.grammar}, using line windows`, err);
    } finally {
      tree?.delete();
      parser?.delete();
    }
  }

  return finalize(lineWindows(lines, 0, lines.count - 1, [], 'block'), lines);
}
