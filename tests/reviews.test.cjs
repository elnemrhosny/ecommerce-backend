const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { createRequire } = require("node:module");
const common = require("../functions/common");
const userId = "d29ee6ce-3607-4134-8701-5a3a8806a1aa";
const productId = "e31945b4-d057-4437-9dfe-803ad82492a1";
const reviewId = "2ec67bf9-31e5-4f8d-a9cc-bc14934b453d";
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const req = createRequire(filename),
    module = { exports: {} };
  vm.runInThisContext(
    `(function(require,module,exports,console){${fs.readFileSync(filename, "utf8")}\n})`,
    { filename },
  )(
    (id) => (Object.hasOwn(mocks, id) ? mocks[id] : req(id)),
    module,
    module.exports,
    { error() {} },
  );
  return module.exports;
}
function repo(query = async () => [[]]) {
  return load("functions/reviews.js", { "../db": { query } });
}
function router(reviews) {
  return load("routes/reviews.js", {
    "../functions/reviews": reviews,
    "../functions/common": common,
    "../functions/authentication": {
      authenticateUser: (req, res, next) => next(),
    },
    "../functions/products": {
      getProductById: async () => ({
        product: { product_id: productId },
        images: [],
      }),
    },
  });
}
function handler(r, method, url = "/") {
  return r.stack
    .find((x) => x.route?.path === url && x.route.methods[method])
    .route.stack.at(-1).handle;
}
function res() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
test("created review is fetched using the authenticated owner ID", async () => {
  let owner;
  const review = {
    review_id: reviewId,
    user_id: userId,
    product_id: productId,
    rating: 5,
    comment: "Lovely",
  };
  const reviews = {
    ...repo(),
    addReview: async () => reviewId,
    getReviewById: async (id, user) => {
      assert.equal(id, reviewId);
      owner = user;
      return review;
    },
  };
  const response = res();
  await handler(router(reviews), "post")(
    {
      body: { product_id: productId, rating: 5, comment: " Lovely " },
      user: { user_id: userId },
    },
    response,
  );
  assert.equal(owner, userId);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body, review);
});
test("duplicate reviews return 409", async () => {
  const reviews = {
    ...repo(),
    addReview: async () => {
      throw Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
    },
  };
  const response = res();
  await handler(router(reviews), "post")(
    {
      body: { product_id: productId, rating: 5, comment: "" },
      user: { user_id: userId },
    },
    response,
  );
  assert.equal(response.statusCode, 409);
});
test("invalid review ratings are rejected before a write", async () => {
  const response = res();
  await handler(
    router({ ...repo(), addReview: () => assert.fail("must not write") }),
    "post",
  )(
    { body: { product_id: productId, rating: 8 }, user: { user_id: userId } },
    response,
  );
  assert.equal(response.statusCode, 400);
});
test("empty review updates are rejected", () => {
  assert.equal(
    repo().validateReviewUpdate({ review_id: reviewId, user_id: userId }).valid,
    false,
  );
});
test("review update SQL has a separated WHERE and binds the owner", async () => {
  let received;
  const reviews = repo(async (sql, params) => {
    received = { sql, params };
    return [{ changedRows: 1 }];
  });
  assert.equal(
    await reviews.updateReview(
      ["rating = ?", "comment = ?"],
      [4, "Updated"],
      reviewId,
      userId,
    ),
    true,
  );
  assert.match(received.sql, /comment = \? WHERE/);
  assert.deepEqual(received.params, [4, "Updated", reviewId, userId]);
});
test("a different user cannot update a review", async () => {
  const response = res();
  await handler(
    router({
      ...repo(),
      getReviewById: async () => undefined,
      updateReview: () => assert.fail("must not write"),
    }),
    "patch",
  )(
    { body: { review_id: reviewId, rating: 4 }, user: { user_id: userId } },
    response,
  );
  assert.equal(response.statusCode, 404);
});
test("a different user cannot delete a review", async () => {
  const response = res();
  await handler(
    router({
      ...repo(),
      getReviewById: async () => undefined,
      deleteReview: () => assert.fail("must not delete"),
    }),
    "delete",
    "/:review_id",
  )({ params: { review_id: reviewId }, user: { user_id: userId } }, response);
  assert.equal(response.statusCode, 404);
});
test("deletion refreshes only the affected product reviews", async () => {
  let refreshed;
  const reviews = {
    ...repo(),
    getReviewById: async () => ({ product_id: productId }),
    deleteReview: async (id, owner) => {
      assert.equal(id, reviewId);
      assert.equal(owner, userId);
      return true;
    },
    getReviewsByProduct: async (id) => {
      refreshed = id;
      return [];
    },
  };
  const response = res();
  await handler(
    router(reviews),
    "delete",
    "/:review_id",
  )({ params: { review_id: reviewId }, user: { user_id: userId } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(refreshed, productId);
  assert.deepEqual(response.body, []);
});
test("public reviews provide a display name without exposing email", async () => {
  let sql;
  const reviews = repo(async (query) => {
    sql = query;
    return [[{ review_id: reviewId, reviewer_name: "Alex", rating: 5 }]];
  });
  const result = await reviews.getReviewsByProduct(productId);
  assert.match(sql, /u.name AS reviewer_name/);
  assert.doesNotMatch(sql, /email/);
  assert.equal(result[0].reviewer_name, "Alex");
});
