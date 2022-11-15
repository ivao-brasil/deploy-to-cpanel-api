import { inspect } from 'util';

export function objToString(obj) {
    return inspect(obj, { showHidden: false, depth: null, colors: true });
}

export async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    }).catch(function () { });
}
