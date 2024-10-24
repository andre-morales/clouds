/**
 * Query object in dot name format from window object
 */
export function getObjectByName(name: string): any {
    let nameParts = name.split('.');
    let nameLength = nameParts.length;
    let scope: any = window;

    for (let i = 0; i < nameLength; ++i) {
        scope = scope[nameParts[i]];
    }

    return scope;
}

export default { getObjectByName };