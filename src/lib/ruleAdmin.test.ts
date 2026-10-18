import { expect, it } from 'vitest';
import { withMembers } from './ruleAdmin.js';

const set = { id: 'g', name: 'Away', rule_ids: ['a', 'b'] };

it('a set gains rules once each, in its order, and loses only those taken out', () => {
	expect(withMembers(set, ['b', 'c', 'd'], true)).toEqual(['a', 'b', 'c', 'd']);
	expect(withMembers(set, ['a', 'z'], false)).toEqual(['b']);
	expect(withMembers(set, [], true)).toEqual(['a', 'b']);
});
