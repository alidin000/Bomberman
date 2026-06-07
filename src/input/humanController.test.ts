import {
  getInputStateForKey,
  getPlayerBindings,
} from './humanController';
import { DEFAULT_KEY_BINDINGS } from '../constants/props';

describe('humanController input mapping', () => {
  it('maps default player two arrow controls by configured slot', () => {
    const bindings = getPlayerBindings(DEFAULT_KEY_BINDINGS, 1)!;

    expect(getInputStateForKey('ArrowUp', bindings).up).toBe(true);
    expect(getInputStateForKey('ArrowLeft', bindings).left).toBe(true);
    expect(getInputStateForKey('ArrowDown', bindings).down).toBe(true);
    expect(getInputStateForKey('ArrowRight', bindings).right).toBe(true);
    expect(getInputStateForKey('o', bindings).bomb).toBe(true);
    expect(getInputStateForKey('i', bindings).detonate).toBe(true);
    expect(getInputStateForKey('p', bindings).special).toBe(true);
    expect(getInputStateForKey('[', bindings).cover).toBe(true);
  });

  it('maps custom player two movement keys instead of using hard-coded directions', () => {
    const customBindings = ['i', 'j', 'k', 'l', 'n', 'b', 'm', ','];

    expect(getInputStateForKey('i', customBindings).up).toBe(true);
    expect(getInputStateForKey('j', customBindings).left).toBe(true);
    expect(getInputStateForKey('k', customBindings).down).toBe(true);
    expect(getInputStateForKey('l', customBindings).right).toBe(true);
    expect(getInputStateForKey('n', customBindings).bomb).toBe(true);
    expect(getInputStateForKey('b', customBindings).detonate).toBe(true);
    expect(getInputStateForKey('m', customBindings).special).toBe(true);
    expect(getInputStateForKey(',', customBindings).cover).toBe(true);
  });
});
