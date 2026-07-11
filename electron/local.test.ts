import { describe, expect, it } from 'vitest';
import { normalizeGitHubRemote } from './local';
describe('normalizeGitHubRemote', () => { it.each([['git@github.com:MiNel0/vigie.git', 'minel0/vigie'], ['https://github.com/MiNel0/vigie.git', 'minel0/vigie'], ['ssh://example.com/a/b', null]])('%s', (input, expected) => expect(normalizeGitHubRemote(input)).toBe(expected)); });
