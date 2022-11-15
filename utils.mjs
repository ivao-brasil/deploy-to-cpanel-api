import { inspect } from 'util';

export function objToString(obj) {
    return inspect(obj, { showHidden: false, depth: null, colors: true });
}