/**
 * The expression language of drawings made in the editor (13 §6.4): small,
 * safe, made for this. It reads the thing's values by name (`level`, `on`,
 * `name`, …), compares them, does arithmetic, picks between values and
 * formats them. It can't reach anything else: there is no property access,
 * no assignment, no way to call anything but the functions below, and it is
 * parsed here, never handed to JavaScript.
 *
 *   on ? (level > 60 ? "Bright" : "Low") + " · " + room : "Off"
 *   round(temperature, 1) + "°"
 */

export type Value = number | string | boolean | null;
export type Vars = Record<string, Value>;

type Node =
	| { t: 'lit'; v: Value }
	| { t: 'var'; name: string }
	| { t: 'un'; op: '!' | '-'; a: Node }
	| { t: 'bin'; op: string; a: Node; b: Node }
	| { t: 'if'; c: Node; a: Node; b: Node }
	| { t: 'call'; name: string; args: Node[] };

const num = (v: Value, fn: string): number => {
	if (typeof v === 'number') return v;
	if (typeof v === 'boolean') return v ? 1 : 0;
	if (v === null) return 0;
	const n = Number(v);
	if (Number.isNaN(n)) throw new Error(`${fn} needs a number`);
	return n;
};
const str = (v: Value): string => (v === null ? '' : String(v));
const truthy = (v: Value): boolean => v !== null && v !== false && v !== 0 && v !== '';

/** What an expression may call. */
const FUNCTIONS: Record<string, (args: Value[]) => Value> = {
	round: ([x, d]) => {
		const p = 10 ** Math.max(0, Math.min(6, Math.trunc(num(d ?? 0, 'round'))));
		return Math.round(num(x ?? 0, 'round') * p) / p;
	},
	floor: ([x]) => Math.floor(num(x ?? 0, 'floor')),
	ceil: ([x]) => Math.ceil(num(x ?? 0, 'ceil')),
	abs: ([x]) => Math.abs(num(x ?? 0, 'abs')),
	min: (a) => Math.min(...a.map((x) => num(x, 'min'))),
	max: (a) => Math.max(...a.map((x) => num(x, 'max'))),
	upper: ([s]) => str(s ?? '').toUpperCase(),
	lower: ([s]) => str(s ?? '').toLowerCase(),
	/** A number with this many digits after the point, as text. */
	fixed: ([x, d]) => num(x ?? 0, 'fixed').toFixed(Math.max(0, Math.min(6, num(d ?? 0, 'fixed'))))
};
export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

const MAX_LENGTH = 300;
const MAX_DEPTH = 24;

/** The pieces of an expression. */
function tokens(src: string): string[] {
	const out: string[] = [];
	const re =
		/\s*(?:(\d+(?:\.\d+)?)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|<=|>=|&&|\|\||[-+*/%<>!?:(),]))/y;
	let at = 0;
	while (at < src.length) {
		if (/^\s*$/.test(src.slice(at))) break;
		re.lastIndex = at;
		const m = re.exec(src);
		if (!m) throw new Error(`Not understood at “${src.slice(at).trim().slice(0, 12)}”`);
		out.push(m[1] ?? m[2] ?? m[3] ?? m[4]!);
		at = re.lastIndex;
	}
	return out;
}

/** Reads an expression into a tree, or throws with why it can't. */
export function parse(src: string): Node {
	if (src.length > MAX_LENGTH) throw new Error(`Longer than ${MAX_LENGTH} characters`);
	const ts = tokens(src);
	let i = 0;
	let depth = 0;
	const peek = () => ts[i];
	const take = (want?: string) => {
		const t = ts[i];
		if (t === undefined) throw new Error(want ? `Expected “${want}” at the end` : 'Ends too soon');
		if (want !== undefined && t !== want) throw new Error(`Expected “${want}”, found “${t}”`);
		i++;
		return t;
	};
	const deeper = <T>(f: () => T): T => {
		if (++depth > MAX_DEPTH) throw new Error('Nested too deeply');
		try {
			return f();
		} finally {
			depth--;
		}
	};
	const binary = (ops: string[], next: () => Node) => (): Node => {
		let a = next();
		while (ops.includes(peek() ?? '')) {
			const op = take();
			a = { t: 'bin', op, a, b: next() };
		}
		return a;
	};
	const expr = (): Node =>
		deeper(() => {
			const c = or();
			if (peek() !== '?') return c;
			take('?');
			const a = expr();
			take(':');
			return { t: 'if', c, a, b: expr() };
		});
	const unary = (): Node =>
		deeper(() => {
			const t = peek();
			if (t === '!' || t === '-') {
				take();
				return { t: 'un', op: t, a: unary() };
			}
			return primary();
		});
	const primary = (): Node => {
		const t = take();
		if (t === '(') {
			const e = expr();
			take(')');
			return e;
		}
		if (/^\d/.test(t)) return { t: 'lit', v: Number(t) };
		if (t[0] === '"' || t[0] === "'")
			return { t: 'lit', v: t.slice(1, -1).replace(/\\(.)/g, '$1') };
		if (t === 'true' || t === 'false') return { t: 'lit', v: t === 'true' };
		if (t === 'null') return { t: 'lit', v: null };
		if (/^[A-Za-z_]/.test(t)) {
			if (peek() !== '(') return { t: 'var', name: t };
			if (!(t in FUNCTIONS)) throw new Error(`There's no “${t}()”`);
			take('(');
			const args: Node[] = [];
			if (peek() !== ')') {
				args.push(expr());
				while (peek() === ',') {
					take(',');
					args.push(expr());
				}
			}
			take(')');
			return { t: 'call', name: t, args };
		}
		throw new Error(`Unexpected “${t}”`);
	};
	const mul = binary(['*', '/', '%'], unary);
	const add = binary(['+', '-'], mul);
	const cmp = binary(['<', '>', '<=', '>='], add);
	const eq = binary(['==', '!='], cmp);
	const and = binary(['&&'], eq);
	const or = binary(['||'], and);
	const tree = expr();
	if (i < ts.length) throw new Error(`Unexpected “${ts[i]}”`);
	return tree;
}

function run(n: Node, vars: Vars): Value {
	switch (n.t) {
		case 'lit':
			return n.v;
		case 'var':
			if (!Object.hasOwn(vars, n.name)) throw new Error(`There's no “${n.name}” here`);
			return vars[n.name] ?? null;
		case 'un':
			return n.op === '!' ? !truthy(run(n.a, vars)) : -num(run(n.a, vars), '-');
		case 'if':
			return truthy(run(n.c, vars)) ? run(n.a, vars) : run(n.b, vars);
		case 'call':
			return FUNCTIONS[n.name]!(n.args.map((a) => run(a, vars)));
		case 'bin': {
			if (n.op === '&&') {
				const a = run(n.a, vars);
				return truthy(a) ? run(n.b, vars) : a;
			}
			if (n.op === '||') {
				const a = run(n.a, vars);
				return truthy(a) ? a : run(n.b, vars);
			}
			const a = run(n.a, vars);
			const b = run(n.b, vars);
			switch (n.op) {
				case '==':
					return a === b;
				case '!=':
					return a !== b;
				case '+':
					return typeof a === 'string' || typeof b === 'string'
						? str(a) + str(b)
						: num(a, '+') + num(b, '+');
				case '-':
					return num(a, '-') - num(b, '-');
				case '*':
					return num(a, '*') * num(b, '*');
				case '/': {
					const d = num(b, '/');
					return d === 0 ? null : num(a, '/') / d;
				}
				case '%': {
					const d = num(b, '%');
					return d === 0 ? null : num(a, '%') % d;
				}
				default: {
					const [x, y] =
						typeof a === 'string' && typeof b === 'string' ? [a, b] : [num(a, n.op), num(b, n.op)];
					return n.op === '<' ? x < y : n.op === '>' ? x > y : n.op === '<=' ? x <= y : x >= y;
				}
			}
		}
	}
}

/** An expression's value for these things, or why it has none. */
export function evaluate(src: string, vars: Vars): { value: Value } | { error: string } {
	try {
		return { value: run(parse(src), vars) };
	} catch (e) {
		return { error: (e as Error).message };
	}
}
