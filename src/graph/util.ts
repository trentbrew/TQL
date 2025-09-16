export const interpolate = (tpl: string, vars: Record<string, unknown>) =>
    tpl.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_m, k) => String(pluck(vars, k) ?? ''));

export function pluck(obj: any, path: string) {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}