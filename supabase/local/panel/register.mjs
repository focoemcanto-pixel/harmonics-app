import { register } from 'node:module';
// Hooks rodam do último registrado para o primeiro: os stubs precisam vir por último.
register('../../../tests/helpers/alias-loader.mjs', import.meta.url);
register('./loader.mjs', import.meta.url);
