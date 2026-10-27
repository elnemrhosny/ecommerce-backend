const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const errorHandler = require('../middlewares/errorHandler');
const common = require('../functions/common');
const productId = '17d394dd-bff1-4b93-ad23-f54b210df064';
const pass = (req, res, next) => next();

function loadRouter(file, products) {
  const filename = path.resolve(__dirname, '../routes', file);
  const localRequire = createRequire(filename);
  const mocks = {
    '../db': {},
    '../functions/products': products,
    '../functions/common': common,
    '../functions/authentication': { authenticateAdmin: pass, optionalAuth: pass },
    '../functions/orders': {},
    '../functions/categories': {},
    '../functions/users': {},
    '../middlewares/upload': { upload: { array: () => pass, single: () => pass } },
  };
  const module = { exports: {} };
  const wrapped = vm.runInThisContext(`(function(require, module, exports, console) {${fs.readFileSync(filename, 'utf8')}\n})`, { filename });
  wrapped((id) => Object.hasOwn(mocks, id) ? mocks[id] : localRequire(id), module, module.exports, { error() {} });
  return module.exports;
}
function handler(router, method, route) {
  return router.stack.find((layer) => layer.route?.path === route && layer.route.methods[method]).route.stack.at(-1).handle;
}
function response() {
  return { headersSent: false, statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
}

test('delete route reports success only after the database finishes', async () => {
  let finish;
  const router = loadRouter('admin.js', { deleteProduct: () => new Promise((resolve) => { finish = resolve; }) });
  const res = response();
  const pending = handler(router, 'delete', '/products/:product_id')({ params: { product_id: productId } }, res);
  assert.equal(res.body, undefined);
  finish(true);
  await pending;
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, 'Product Deleted');
});
test('delete route returns 404 for a missing product', async () => {
  const router = loadRouter('admin.js', { deleteProduct: async () => undefined });
  const res = response();
  await handler(router, 'delete', '/products/:product_id')({ params: { product_id: productId } }, res);
  assert.equal(res.statusCode, 404);
});
for (const code of ['ER_ROW_IS_REFERENCED_2', 'ER_ROW_IS_REFERENCED']) {
  test(`delete route preserves referenced records and returns 409 for ${code}`, async () => {
    const router = loadRouter('admin.js', { deleteProduct: async () => { throw Object.assign(new Error('foreign key'), { code }); } });
    const res = response();
    await handler(router, 'delete', '/products/:product_id')({ params: { product_id: productId } }, res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body, /Deactivate it instead/);
  });
}
test('delete route returns a response for database failures', async () => {
  const router = loadRouter('admin.js', { deleteProduct: async () => { throw new Error('database unavailable'); } });
  const res = response();
  await handler(router, 'delete', '/products/:product_id')({ params: { product_id: productId } }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body, 'Internal Server Error');
});
test('delete route rejects invalid IDs before querying', async () => {
  const router = loadRouter('admin.js', { deleteProduct: () => assert.fail('must not query') });
  const res = response();
  await handler(router, 'delete', '/products/:product_id')({ params: { product_id: 'bad-id' } }, res);
  assert.equal(res.statusCode, 400);
});
test('multiple uploads choose the first image as main exactly once', async () => {
  const main = [], added = [];
  const router = loadRouter('admin.js', {
    getProductById: async () => ({ product: { image_url: null }, images: [] }),
    setMainImage: async (...args) => main.push(args),
    addImage: async (...args) => added.push(args),
  });
  const res = response();
  await handler(router, 'post', '/product_images')({ body: { product_id: productId }, files: [{ path: 'first.jpg', filename: 'first' }, { path: 'second.jpg', filename: 'second' }] }, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(main, [[productId, 'first.jpg', 'first']]);
  assert.equal(added.length, 2);
});
test('empty product pages keep total count and use decimal pagination', async () => {
  let params;
  const router = loadRouter('products.js', {
    getProductsByFilter: async (...args) => { params = args; return undefined; },
    getCount: async () => 12,
  });
  const res = response();
  await handler(router, 'get', '/')({ query: { limit: '12', offset: '12' } }, res);
  assert.deepEqual(res.body, { products: [], count: 12 });
  assert.equal(params.at(-1), 12);
});
test('CORS errors finish with HTTP 403', () => {
  const res = response();
  errorHandler(Object.assign(new Error('Not allowed by CORS'), { status: 403 }), {}, res, () => assert.fail());
  assert.equal(res.statusCode, 403);
});
test('malformed JSON keeps its HTTP 400 response', () => {
  const res = response();
  errorHandler(Object.assign(new SyntaxError('bad JSON'), { status: 400, body: '{' }), {}, res, () => assert.fail());
  assert.equal(res.statusCode, 400);
});
test('unexpected errors finish with HTTP 500 without exposing details', () => {
  const res = response();
  const original = console.error;
  console.error = () => {};
  try { errorHandler(new Error('private internal details'), {}, res, () => assert.fail()); }
  finally { console.error = original; }
  assert.equal(res.statusCode, 500);
  assert.equal(res.body, 'Internal Server Error');
});
test('errors after headers are sent delegate to Express', () => {
  const error = new Error('stream error');
  let forwarded;
  errorHandler(error, {}, { headersSent: true }, (err) => { forwarded = err; });
  assert.equal(forwarded, error);
});
